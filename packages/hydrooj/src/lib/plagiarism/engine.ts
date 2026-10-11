import { createHash } from 'crypto';

export const MAX_SOURCE_BYTES = 256 * 1024;
export const MAX_TOKENS = 30000;
export const SOFT_TIMEOUT_MS = 10_000;
export const ENGINE_VERSION = 'cpp-lexical-v1';
export const CPP_WARNING_CODES = [
    'short-source', 'preprocessor-not-expanded', 'incomplete-comment', 'incomplete-raw-string',
    'incomplete-string', 'unused-scalar-ignored', 'evidence-regions-limited', 'tree-sitter-parse-errors',
] as const;

const GRAM_LENGTH = 16;
const WINDOW_LENGTH = 5;
const MIN_EVIDENCE_TOKENS = 40;
export const MAX_MATCHES = 100;

export type PlagiarismLimitCode = 'source-too-large' | 'too-many-tokens' | 'deadline-exceeded';

export class PlagiarismLimitError extends Error {
    constructor(public readonly code: PlagiarismLimitCode, message: string) {
        super(message);
        this.name = 'PlagiarismLimitError';
    }
}

export interface CppToken { value: string, kind: 'identifier' | 'fixed', line: number, endLine: number }
export interface Feature { count: number, weight: number }
interface TokenInterval { left: number, right: number, length: number }

export interface PreparedCpp {
    tokenCount: number;
    warnings: string[];
    tokens: CppToken[];
    canonical: string;
    grams: Map<string, Feature>;
    fingerprints: Map<string, number[]>;
    statements: Map<string, Feature>;
}

export interface CppMatch {
    leftStartLine: number;
    leftEndLine: number;
    rightStartLine: number;
    rightEndLine: number;
    tokenCount: number;
}

export interface CppComparison {
    similarity: number;
    scores: { token: number, structure: number, fingerprint: number };
    matches: CppMatch[];
    warnings: string[];
}

const KEYWORDS = new Set(`alignas alignof and and_eq asm atomic_cancel atomic_commit atomic_noexcept auto
    bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval
    constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double
    dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable
    namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast
    requires return short signed sizeof static static_assert static_cast struct switch template this thread_local
    throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq`
    .split(/\s+/));
export const LIBRARY_NAMES = new Set(`main std cin cout cerr clog endl scanf printf getchar putchar puts gets
    fread fwrite sort stable_sort lower_bound upper_bound binary_search reverse swap min max abs sqrt pow gcd
    lcm accumulate iota unique distance begin end size empty push_back pop_back emplace_back push pop top front
    back insert erase find count clear resize reserve assign fill memset memcpy malloc free vector array deque
    queue priority_queue stack set multiset map multimap unordered_set unordered_map string pair tuple make_pair
    make_tuple get bitset numeric_limits sync_with_stdio tie`.split(/\s+/));
const SCALAR_TYPES = new Set('bool char char8_t char16_t char32_t double float int long short signed unsigned wchar_t'.split(' '));
const LIBRARY_TYPES = new Set(`vector array deque queue priority_queue stack set multiset map multimap
    unordered_set unordered_map string pair tuple bitset numeric_limits`.split(/\s+/));
const STREAM_NAMES = new Set('cin cout cerr clog'.split(' '));
const DECLARATION_TYPES = new Set([...SCALAR_TYPES, ...LIBRARY_TYPES, 'void', 'auto']);
const CONTROL_WORDS = new Set('if for while switch catch else do try'.split(' '));
const OPERATORS = ['%:%:', '<=>', '>>=', '<<=', '->*', '...', '::', '++', '--', '->', '.*', '&&', '||',
    '<=', '>=', '==', '!=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '##', '<:', ':>', '<%', '%>', '%:'];

export function checkDeadline(deadline: number) {
    if (Date.now() >= deadline) {
        throw new PlagiarismLimitError('deadline-exceeded', 'The C++ similarity comparison exceeded its ten-second soft time limit.');
    }
}

function isIdentifierStart(character: string) {
    return !!character && (/[A-Za-z_]/.test(character) || character.charCodeAt(0) > 127);
}

function isIdentifierPart(character: string) {
    return isIdentifierStart(character) || (!!character && /[0-9]/.test(character));
}

function lex(source: string, deadline: number, warnings: Set<string>): CppToken[] {
    // Splicing precedes comment recognition in C++; retain an original line map for review evidence.
    const characters: string[] = [];
    const lines: number[] = [];
    let line = 1;
    for (let i = 0; i < source.length; i++) {
        if (!(i % 2048)) checkDeadline(deadline);
        if (source[i] === '\\' && (source[i + 1] === '\n' || (source[i + 1] === '\r' && source[i + 2] === '\n'))) {
            i += source[i + 1] === '\r' ? 2 : 1;
            line++;
        } else {
            characters.push(source[i]);
            lines.push(line);
            if (source[i] === '\n') line++;
        }
    }
    const text = characters.join('');
    const tokens: CppToken[] = [];
    let i = 0;
    let lineStart = true;
    const add = (value: string, start: number, end: number, kind: CppToken['kind'] = 'fixed') => {
        tokens.push({ value, kind, line: lines[start], endLine: lines[Math.max(start, end - 1)] });
        if (tokens.length > MAX_TOKENS) {
            throw new PlagiarismLimitError('too-many-tokens', `C++ submissions may contain at most ${MAX_TOKENS} lexical tokens.`);
        }
    };
    while (i < text.length) {
        if (!(i % 512)) checkDeadline(deadline);
        if (/\s/.test(text[i])) {
            if (text[i] === '\n') lineStart = true;
            i++;
            continue;
        }
        if (text.startsWith('//', i)) {
            const end = text.indexOf('\n', i + 2);
            i = end < 0 ? text.length : end;
            continue;
        }
        if (text.startsWith('/*', i)) {
            const end = text.indexOf('*/', i + 2);
            if (end < 0) {
                warnings.add('incomplete-comment');
                break;
            }
            if (text.slice(i, end + 2).includes('\n')) lineStart = true;
            i = end + 2;
            continue;
        }
        if (lineStart && text[i] === '#') {
            const end = text.indexOf('\n', i);
            const directive = text.slice(i, end < 0 ? text.length : end);
            if (/^#\s*(?:include|pragma)\b/.test(directive)) {
                i = end < 0 ? text.length : end;
                continue;
            }
            warnings.add('preprocessor-not-expanded');
        }
        lineStart = false;
        const start = i;
        const literal = /^(?:u8|[uUL])?(R)?(["'])/.exec(text.slice(i, i + 5));
        if (literal) {
            const quote = literal[2];
            i += literal[0].length;
            if (literal[1] && quote === '"') {
                const opening = text.indexOf('(', i);
                const delimiter = opening < 0 ? '' : text.slice(i, opening);
                const ending = opening >= 0 && delimiter.length <= 16 ? text.indexOf(`)${delimiter}"`, opening + 1) : -1;
                if (ending < 0) {
                    warnings.add('incomplete-raw-string');
                    i = text.length;
                } else i = ending + delimiter.length + 2;
            } else {
                let closed = false;
                while (i < text.length) {
                    if (text[i] === '\\') i += 2;
                    else if (text[i++] === quote) {
                        closed = true;
                        break;
                    }
                }
                if (!closed) warnings.add('incomplete-string');
            }
            i = Math.min(i, text.length);
            // Digest literals to bound feature sizes; the entire literal value still participates in comparison.
            add(`literal:${createHash('sha256').update(text.slice(start, i)).digest('hex')}`, start, i);
        } else if (isIdentifierStart(text[i])) {
            while (isIdentifierPart(text[++i])) { /* Scan the complete identifier. */ }
            const value = text.slice(start, i);
            add(value, start, i, KEYWORDS.has(value) ? 'fixed' : 'identifier');
        } else if (/[0-9]/.test(text[i]) || (text[i] === '.' && /[0-9]/.test(text[i + 1] || ''))) {
            i++;
            while (i < text.length && /[A-Za-z0-9_'.]/.test(text[i])) i++;
            // Keep numerical values; only digit separator spelling is irrelevant.
            add(`number:${text.slice(start, i).replace(/'/g, '').toLowerCase()}`, start, i);
        } else {
            const operator = OPERATORS.find((candidate) => text.startsWith(candidate, start)) || text[i];
            i += operator.length;
            add(operator, start, i);
        }
    }
    checkDeadline(deadline);
    return tokens;
}

function classifyLibraryNames(tokens: CppToken[], deadline: number) {
    const declared = new Set<string>();
    for (let i = 0; i < tokens.length; i++) {
        if (!(i % 128)) checkDeadline(deadline);
        if (!LIBRARY_NAMES.has(tokens[i].value) || declared.has(tokens[i].value)) continue;
        let previous = i - 1;
        while (previous >= 0 && ['*', '&', '&&', 'const', 'volatile'].includes(tokens[previous].value)) previous--;
        if (DECLARATION_TYPES.has(tokens[previous]?.value)) declared.add(tokens[i].value);
        // A template type followed by a declarator, such as vector<int> count or vector<vector<int>> size.
        if (tokens[previous]?.value === '>' || tokens[previous]?.value === '>>') {
            let depth = tokens[previous].value === '>>' ? 2 : 1;
            previous--;
            let scanned = 0;
            // Comparison operators can resemble closing template brackets. Keep declaration inference local.
            while (previous >= 0 && depth > 0 && scanned++ < 64) {
                if ([';', '{', '}'].includes(tokens[previous].value)) break;
                if (tokens[previous].value === '>') depth++;
                if (tokens[previous].value === '>>') depth += 2;
                if (tokens[previous].value === '<') depth--;
                previous--;
            }
            if (!depth && DECLARATION_TYPES.has(tokens[previous]?.value)) declared.add(tokens[i].value);
        }
    }
    for (let i = 0; i < tokens.length; i++) {
        if (!(i % 128)) checkDeadline(deadline);
        const token = tokens[i];
        if (token.kind !== 'identifier') continue;
        const qualifiedStandard = tokens[i - 1]?.value === '::' && tokens[i - 2]?.value === 'std';
        if (qualifiedStandard || (token.value === 'main' && tokens[i + 1]?.value === '(')) {
            token.kind = 'fixed';
            continue;
        }
        if (!LIBRARY_NAMES.has(token.value) || declared.has(token.value)) continue;
        const next = tokens[i + 1]?.value;
        const stream = (STREAM_NAMES.has(token.value) && (['<<', '>>'].includes(next)
            || ['<<', '>>'].includes(tokens[i - 1]?.value)))
        || (token.value === 'endl' && tokens[i - 1]?.value === '<<');
        const libraryType = LIBRARY_TYPES.has(token.value) && (next === '<' || tokens[i + 1]?.kind === 'identifier');
        // A familiar name is an operation only at a call/type/stream site; plain variables remain renameable.
        if (next === '(' || stream || libraryType) token.kind = 'fixed';
    }
}

function removeBoilerplate(tokens: CppToken[], warnings: Set<string>) {
    const counts = new Map<string, number>();
    for (const token of tokens) if (token.kind === 'identifier') counts.set(token.value, (counts.get(token.value) || 0) + 1);
    const output: CppToken[] = [];
    let removed = false;
    for (let i = 0; i < tokens.length;) {
        if (tokens[i].value === 'std' && tokens[i + 1]?.value === '::') {
            i += 2;
            continue;
        }
        if (tokens.slice(i, i + 4).map((token) => token.value).join(' ') === 'using namespace std ;') {
            i += 4;
            continue;
        }
        // Only remove a standalone, single unused built-in scalar with no side-effecting initializer.
        const boundary = i === 0 || [';', '{', '}'].includes(tokens[i - 1].value);
        let cursor = i;
        if (tokens[cursor]?.value === 'const') cursor++;
        const typeStart = cursor;
        while (SCALAR_TYPES.has(tokens[cursor]?.value)) cursor++;
        if (boundary && cursor > typeStart && tokens[cursor]?.kind === 'identifier' && counts.get(tokens[cursor].value) === 1) {
            cursor++;
            if (tokens[cursor]?.value === '=') {
                cursor++;
                while (tokens[cursor] && (tokens[cursor].value.startsWith('number:')
                    || ['true', 'false', '+', '-'].includes(tokens[cursor].value))) cursor++;
            }
            if (tokens[cursor]?.value === ';') {
                i = cursor + 1;
                removed = true;
                continue;
            }
        }
        output.push(tokens[i++]);
    }
    if (removed) warnings.add('unused-scalar-ignored');
    return output;
}

function canonicalize(tokens: CppToken[], start = 0, end = tokens.length) {
    const identifiers = new Map<string, number>();
    const result: string[] = [];
    for (let i = start; i < end; i++) {
        const token = tokens[i];
        if (token.kind === 'fixed') result.push(`f:${token.value}`);
        else {
            if (!identifiers.has(token.value)) identifiers.set(token.value, identifiers.size);
            result.push(`i:${identifiers.get(token.value)}`);
        }
    }
    return JSON.stringify(result);
}

function hash(key: string) {
    let result = 2166136261;
    for (let i = 0; i < key.length; i++) result = Math.imul(result ^ key.charCodeAt(i), 16777619);
    return result >>> 0;
}

function addFeature(features: Map<string, Feature>, key: string, weight: number) {
    const feature = features.get(key);
    if (feature) feature.count++;
    else features.set(key, { count: 1, weight });
}

function featureKey(tokens: CppToken[], start: number, end: number) {
    // Compact cryptographic keys bound per-submission memory without accepting 32-bit hash collisions as evidence.
    return createHash('sha256').update(canonicalize(tokens, start, end)).digest('base64url');
}

function statementFeatures(tokens: CppToken[], deadline: number) {
    const features = new Map<string, Feature>();
    let start = 0;
    let parentheses = 0;
    const add = (end: number) => {
        if (end - start >= 4) addFeature(features, featureKey(tokens, start, end), end - start);
        start = end + 1;
    };
    for (let i = 0; i < tokens.length; i++) {
        if (!(i % 256)) checkDeadline(deadline);
        const value = tokens[i].value;
        if (value === '(') parentheses++;
        if (value === ')') parentheses = Math.max(0, parentheses - 1);
        if (value === '{') {
            // Exclude function signatures from this view, preserving each body's independent statements.
            const first = tokens[start]?.value;
            const signature = parentheses === 0 && tokens[i - 1]?.value === ')' && !CONTROL_WORDS.has(first);
            if (signature) start = i + 1;
            else add(i);
        } else if (value === '}' || (value === ';' && !parentheses)) add(i);
    }
    return features;
}

export function prepareCppTokens(tokens: CppToken[], warnings: Set<string>, deadline: number, structure?: Map<string, Feature>): PreparedCpp {
    if (tokens.length < MIN_EVIDENCE_TOKENS) warnings.add('short-source');
    const grams = new Map<string, Feature>();
    const fingerprints = new Map<string, number[]>();
    const keys: string[] = [];
    const hashes: number[] = [];
    for (let i = 0; i + GRAM_LENGTH <= tokens.length; i++) {
        if (!(i % 128)) checkDeadline(deadline);
        const key = featureKey(tokens, i, i + GRAM_LENGTH);
        keys.push(key);
        hashes.push(hash(key));
        addFeature(grams, key, 1);
    }
    // Monotone queue selects the rightmost minimum in each sliding window in linear time.
    const queue: number[] = [];
    let head = 0;
    let selected = -1;
    const windowLength = Math.min(WINDOW_LENGTH, hashes.length);
    for (let i = 0; i < hashes.length; i++) {
        while (queue.length > head && hashes[queue[queue.length - 1]] >= hashes[i]) queue.pop();
        queue.push(i);
        while (queue[head] <= i - windowLength) head++;
        if (i >= windowLength - 1 && selected !== queue[head]) {
            selected = queue[head];
            const positions = fingerprints.get(keys[selected]);
            if (positions) positions.push(selected);
            else fingerprints.set(keys[selected], [selected]);
        }
    }
    const statements = structure ?? statementFeatures(tokens, deadline);
    const canonical = canonicalize(tokens);
    checkDeadline(deadline);
    return { tokenCount: tokens.length, warnings: [...warnings], tokens, canonical, grams, fingerprints, statements };
}

export function prepareCpp(source: string, options: { deadline?: number } = {}): PreparedCpp {
    const deadline = Math.min(options.deadline ?? Infinity, Date.now() + SOFT_TIMEOUT_MS);
    if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
        throw new PlagiarismLimitError('source-too-large', `C++ submissions may contain at most ${MAX_SOURCE_BYTES} bytes.`);
    }
    const warnings = new Set<string>();
    const lexical = lex(source, deadline, warnings);
    classifyLibraryNames(lexical, deadline);
    const tokens = removeBoilerplate(lexical, warnings);
    return prepareCppTokens(tokens, warnings, deadline);
}

function featureSimilarity(left: Map<string, Feature>, right: Map<string, Feature>, deadline: number) {
    let leftWeight = 0;
    let rightWeight = 0;
    let shared = 0;
    let index = 0;
    for (const [key, feature] of left) {
        if (!(index++ % 128)) checkDeadline(deadline);
        leftWeight += feature.count * feature.weight;
        shared += Math.min(feature.count, right.get(key)?.count || 0) * feature.weight;
    }
    for (const feature of right.values()) {
        if (!(index++ % 128)) checkDeadline(deadline);
        rightWeight += feature.count * feature.weight;
    }
    if (!leftWeight || !rightWeight) return { score: 0, shared: 0 };
    // Containment catches an unchanged core surrounded by padding; Dice still accounts for unequal sizes.
    const score = 100 * (0.7 * shared / Math.min(leftWeight, rightWeight) + 0.3 * 2 * shared / (leftWeight + rightWeight));
    return { score, shared };
}

function fingerprintFeatures(fingerprints: Map<string, number[]>) {
    return new Map([...fingerprints].map(([key, positions]) => [key, { count: positions.length, weight: 1 }]));
}

function matchingIntervals(left: PreparedCpp, right: PreparedCpp, deadline: number) {
    const intervals: TokenInterval[] = [];
    let checked = 0;
    for (const [key, positions] of left.fingerprints) {
        const counterparts = right.fingerprints.get(key);
        if (!counterparts) continue;
        // Pair each occurrence once; never expand repeated fingerprints into a quadratic Cartesian product.
        for (let i = 0; i < Math.min(positions.length, counterparts.length); i++) {
            if (!(checked++ % 128)) checkDeadline(deadline);
            intervals.push({ left: positions[i], right: counterparts[i], length: GRAM_LENGTH });
        }
    }
    intervals.sort((a, b) => a.left - b.left || a.right - b.right);
    const merged: TokenInterval[] = [];
    for (const interval of intervals) {
        const previous = merged[merged.length - 1];
        if (previous && previous.right - previous.left === interval.right - interval.left
            && interval.left <= previous.left + previous.length) {
            previous.length = Math.max(previous.length, interval.left + interval.length - previous.left);
        } else merged.push({ ...interval });
    }
    checkDeadline(deadline);
    return merged;
}

function lineMatch(left: PreparedCpp, right: PreparedCpp, interval: TokenInterval): CppMatch {
    return {
        leftStartLine: left.tokens[interval.left].line,
        leftEndLine: left.tokens[interval.left + interval.length - 1].endLine,
        rightStartLine: right.tokens[interval.right].line,
        rightEndLine: right.tokens[interval.right + interval.length - 1].endLine,
        tokenCount: interval.length,
    };
}

function round(score: number) {
    return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
}

export function compareCpp(left: PreparedCpp, right: PreparedCpp, options: { deadline?: number } = {}): CppComparison {
    const deadline = Math.min(options.deadline ?? Infinity, Date.now() + SOFT_TIMEOUT_MS);
    checkDeadline(deadline);
    const warnings = new Set([...left.warnings, ...right.warnings]);
    const short = Math.min(left.tokenCount, right.tokenCount) < MIN_EVIDENCE_TOKENS;
    if (!left.tokenCount || !right.tokenCount) {
        return { similarity: 0, scores: { token: 0, structure: 0, fingerprint: 0 }, matches: [], warnings: [...warnings] };
    }
    if (left.canonical === right.canonical) {
        const score = short ? 55 : 100;
        checkDeadline(deadline);
        return {
            similarity: score,
            scores: { token: 100, structure: 100, fingerprint: 100 },
            matches: [lineMatch(left, right, { left: 0, right: 0, length: left.tokenCount })],
            warnings: [...warnings],
        };
    }
    const token = featureSimilarity(left.grams, right.grams, deadline);
    const structure = featureSimilarity(left.statements, right.statements, deadline);
    const fingerprint = featureSimilarity(fingerprintFeatures(left.fingerprints), fingerprintFeatures(right.fingerprints), deadline);
    const intervals = matchingIntervals(left, right, deadline);
    let similarity = Math.max(0.8 * token.score + 0.2 * fingerprint.score, 0.8 * structure.score + 0.2 * token.score);
    // Structural bags alone can agree on common idioms; require at least one verified 16-token region.
    if (!intervals.length) similarity = Math.min(similarity, 35);
    if (short) similarity = Math.min(similarity, 55);
    if (intervals.length > MAX_MATCHES) warnings.add('evidence-regions-limited');
    checkDeadline(deadline);
    return {
        similarity: round(similarity),
        scores: { token: round(token.score), structure: round(structure.score), fingerprint: round(fingerprint.score) },
        matches: intervals.sort((a, b) => b.length - a.length || a.left - b.left || a.right - b.right)
            .slice(0, MAX_MATCHES).sort((a, b) => a.left - b.left || a.right - b.right)
            .map((interval) => lineMatch(left, right, interval)),
        warnings: [...warnings],
    };
}
