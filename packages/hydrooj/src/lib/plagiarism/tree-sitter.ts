import { createHash } from 'crypto';
import Parser from 'tree-sitter';
import Cpp from 'tree-sitter-cpp';
import {
    checkDeadline, type CppToken, type Feature, LIBRARY_NAMES, MAX_SOURCE_BYTES, MAX_TOKENS,
    PlagiarismLimitError, prepareCppTokens, SOFT_TIMEOUT_MS,
} from './engine';

const IDENTIFIERS = new Set(['identifier', 'field_identifier', 'type_identifier', 'namespace_identifier', 'statement_identifier']);
const LITERALS = new Set(['string_literal', 'raw_string_literal', 'char_literal', 'number_literal']);
const STREAM_NAMES = new Set(['cin', 'cout', 'cerr', 'clog', 'endl']);
const STRUCTURES = new Set([
    'declaration', 'expression_statement', 'return_statement', 'if_statement', 'for_statement',
    'for_range_loop', 'while_statement', 'do_statement', 'switch_statement', 'case_statement',
    'throw_statement', 'try_statement', 'call_expression', 'assignment_expression', 'binary_expression',
]);

function ignored(node: Parser.SyntaxNode) {
    return (node.type === 'translation_unit' && !node.childCount) || node.type === 'comment' || node.type === 'preproc_include'
        || (node.type === 'preproc_call' && /^#\s*pragma\b/.test(node.text))
        || (node.type === 'using_declaration' && /^using\s+namespace\s+std\s*;$/.test(node.text))
        || (node.type === 'namespace_identifier' && node.text === 'std')
        || (node.type === '::' && node.previousSibling?.text === 'std');
}

function tokenValue(node: Parser.SyntaxNode, declared: Set<string>): Pick<CppToken, 'value' | 'kind'> {
    if (LITERALS.has(node.type)) {
        return {
            value: node.type === 'number_literal' ? `number:${node.text.replace(/'/g, '').toLowerCase()}`
                : `literal:${createHash('sha256').update(node.text).digest('hex')}`,
            kind: 'fixed',
        };
    }
    if (IDENTIFIERS.has(node.type)) {
        const parent = node.parent;
        const qualifier = parent?.type === 'template_function' || parent?.type === 'template_type' ? parent.parent : parent;
        const standard = qualifier?.type === 'qualified_identifier' && qualifier.childForFieldName('scope')?.text === 'std';
        const operation = parent?.type === 'call_expression' && parent.childForFieldName('function')?.id === node.id;
        const libraryType = parent?.type === 'template_type' || parent?.type === 'template_function';
        const entry = node.text === 'main' && parent?.type === 'function_declarator';
        const stream = STREAM_NAMES.has(node.text) && parent?.type === 'binary_expression'
            && ['<<', '>>'].includes(parent.childForFieldName('operator')?.text);
        const library = LIBRARY_NAMES.has(node.text) && !declared.has(node.text)
            && (operation || libraryType || stream || node.type === 'field_identifier');
        return { value: node.text, kind: standard || entry || library ? 'fixed' : 'identifier' };
    }
    return { value: node.text, kind: 'fixed' };
}

export function prepareTreeSitterCpp(source: string, options: { deadline?: number } = {}) {
    const deadline = Math.min(options.deadline ?? Infinity, Date.now() + SOFT_TIMEOUT_MS);
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
        throw new PlagiarismLimitError('source-too-large', `C++ submissions may contain at most ${MAX_SOURCE_BYTES} bytes.`);
    }
    checkDeadline(deadline);
    const parser = new Parser();
    parser.setLanguage(Cpp);
    parser.setTimeoutMicros(Math.max(1, deadline - Date.now()) * 1000);
    const tree = parser.parse(source, undefined, { bufferSize: MAX_SOURCE_BYTES * 2 });
    checkDeadline(deadline);
    const warnings = new Set<string>();
    if (tree.rootNode.hasError) warnings.add('tree-sitter-parse-errors');
    // Collect actual declarators before classifying familiar library names, without lexical declaration inference.
    const declared = new Set<string>();
    const declarations = tree.walk();
    let visited = 0;
    do {
        if (!(visited++ % 128)) checkDeadline(deadline);
        const node = declarations.currentNode;
        if (IDENTIFIERS.has(node.type) && declarations.currentFieldName === 'declarator') declared.add(node.text);
        if (declarations.gotoFirstChild()) continue;
        while (!declarations.gotoNextSibling()) if (!declarations.gotoParent()) break;
    } while (declarations.currentDepth > 0);

    const tokens: CppToken[] = [];
    const structure = new Map<string, Feature>();
    const cursor = tree.walk();
    // Incremental subtree hashes avoid storing an entire normalized AST or repeatedly serializing nested bodies.
    const frames: Array<{ type: string, start: number, hash: ReturnType<typeof createHash> }> = [];
    while (true) {
        if (!(visited++ % 128)) checkDeadline(deadline);
        const node = cursor.currentNode;
        const skip = ignored(node);
        if (node.type.startsWith('preproc_') && !skip) warnings.add('preprocessor-not-expanded');
        const atomic = LITERALS.has(node.type) || !node.childCount;
        if (!skip && !node.isMissing && atomic) {
            const value = tokenValue(node, declared);
            tokens.push({ ...value, line: node.startPosition.row + 1, endLine: node.endPosition.row + 1 });
            if (tokens.length > MAX_TOKENS) {
                throw new PlagiarismLimitError('too-many-tokens', `C++ submissions may contain at most ${MAX_TOKENS} lexical tokens.`);
            }
            frames.at(-1)?.hash.update(JSON.stringify([node.type, value.kind === 'identifier' ? '$id' : value.value]));
        } else if (!skip && !node.isMissing) {
            frames.push({ type: node.type, start: tokens.length, hash: createHash('sha256').update(node.type) });
            if (cursor.gotoFirstChild()) continue;
        }
        while (!cursor.gotoNextSibling()) {
            if (!cursor.gotoParent()) return prepareCppTokens(tokens, warnings, deadline, structure);
            const frame = frames.pop()!;
            const key = frame.hash.digest('base64url');
            const length = tokens.length - frame.start;
            if (STRUCTURES.has(frame.type) && length >= 4) {
                const feature = structure.get(key);
                if (feature) feature.count++;
                else structure.set(key, { count: 1, weight: Math.min(length, 16) });
            }
            frames.at(-1)?.hash.update(key);
        }
    }
}
