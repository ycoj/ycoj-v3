import type { Literal, Root } from 'mdast';
import type {
  CompileContext,
  Extension as MdastExtension,
} from 'mdast-util-from-markdown';
import { fromMarkdown } from 'mdast-util-from-markdown';
import type {
  Code,
  Construct,
  Extension,
  State,
  Token,
  Tokenizer,
} from 'micromark-util-types';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

type Latex = Literal & { type: 'latex' };

declare module 'mdast' {
  interface RootContentMap {
    latex: Latex;
  }
  interface PhrasingContentMap {
    latex: Latex;
  }
}

declare module 'micromark-util-types' {
  interface TokenTypeMap {
    latex: 'latex';
    latexData: 'latexData';
  }
  interface Token {
    latexDisplay?: boolean;
    latexDelimiterLength?: number;
  }
}

function isLineEnding(code: Code) {
  return code === -5 || code === -4 || code === -3;
}

// Both constructs read TeX verbatim. Markdown never sees the formula's
// backslashes, punctuation, or line breaks, so no source escaping is needed.
function tokenizeLatex(block: boolean): Tokenizer {
  return function (effects, ok, nok) {
    let delimiter: 'dollar' | 'paren';
    let length = 1;
    let escaped = false;
    let closingLength = 0;
    let token: Token;
    let inData = false;
    let hasLineEnding = false;
    let braceDepth = 0;

    const consume = (code: Code) => {
      if (isLineEnding(code)) {
        hasLineEnding = true;
        if (inData) effects.exit('latexData');
        inData = false;
        effects.enter('lineEnding');
        effects.consume(code);
        effects.exit('lineEnding');
      } else {
        if (!inData) effects.enter('latexData');
        inData = true;
        effects.consume(code);
      }
    };

    const content: State = (code) => {
      if (code === null) return nok(code);
      if (
        !escaped &&
        braceDepth === 0 &&
        code === (delimiter === 'dollar' ? 36 : 92)
      ) {
        closingLength = 0;
        return closing(code);
      }
      if (!escaped && code === 123) braceDepth += 1;
      if (!escaped && code === 125) braceDepth -= 1;
      consume(code);
      escaped = !escaped && code === 92;
      return content;
    };

    const closing: State = (code) => {
      if (delimiter === 'paren') {
        consume(code);
        return closeParen;
      }
      if (code === 36 && closingLength < length) {
        consume(code);
        closingLength += 1;
        return closingLength === length ? finish : closing;
      }
      return content(code);
    };

    const closeParen: State = (code) => {
      if (code === 41) {
        consume(code);
        return finish;
      }
      // A backslash that did not close the formula still escapes the next
      // character (including a second backslash) inside the TeX source.
      escaped = true;
      return content(code);
    };

    const finish: State = (code) => {
      if (block && !hasLineEnding) return nok(code);
      if (block && code !== null && !isLineEnding(code)) {
        if (code === 32 || code === -1 || code === -2) {
          consume(code);
          return finish;
        }
        return nok(code);
      }
      if (inData) effects.exit('latexData');
      effects.exit('latex');
      return ok(code);
    };

    const afterDollars: State = (code) => {
      if (block) {
        if (length !== 2) return nok(code);
      }
      token.latexDisplay = length === 2;
      token.latexDelimiterLength = length;
      return content(code);
    };

    const secondDollar: State = (code) => {
      if (code === 36) {
        consume(code);
        length = 2;
        return afterDollars;
      }
      return afterDollars(code);
    };

    const openParen: State = (code) => {
      if (code !== 40 || block) return nok(code);
      consume(code);
      token.latexDisplay = false;
      token.latexDelimiterLength = 2;
      return content;
    };

    return (code) => {
      token = effects.enter('latex');
      delimiter = code === 36 ? 'dollar' : 'paren';
      consume(code);
      return delimiter === 'dollar' ? secondDollar : openParen;
    };
  };
}

const inline: Construct = {
  name: 'latexInline',
  tokenize: tokenizeLatex(false),
  previous(code) {
    const previous = this.events.at(-1);
    return (
      code !== 36 || (previous?.[0] === 'exit' && previous[1].type === 'latex')
    );
  },
};
const block: Construct = {
  name: 'latexBlock',
  tokenize: tokenizeLatex(true),
  concrete: true,
};
const syntax: Extension = {
  flow: { 36: block },
  text: { 36: inline, 92: inline },
};

function enterLatex(this: CompileContext, token: Token) {
  const length = token.latexDelimiterLength ?? 2;
  const source = this.sliceSerialize(token).trimEnd();
  const value = source.slice(length, -length);
  const node: Latex = {
    type: 'latex',
    value,
    data: {
      hName: 'code',
      hProperties: {
        className: [token.latexDisplay ? 'math-display' : 'math-inline'],
      },
      hChildren: [{ type: 'text', value }],
    },
  };
  this.enter(node, token);
  this.buffer();
}

const ast: MdastExtension = {
  enter: { latex: enterLatex },
  exit: {
    latex(token) {
      this.resume();
      this.exit(token);
    },
  },
};

// Raw HTML is parsed by rehype rather than remark. Reuse the same syntax to
// locate formulas in its text while leaving all surrounding HTML text intact.
export function parseLatexText(source: string): Latex[] {
  const tree = fromMarkdown(source, {
    extensions: [syntax],
    mdastExtensions: [ast],
  });
  const formulas: Latex[] = [];
  visit(tree, 'latex', (node) => {
    formulas.push(node);
  });
  return formulas;
}

const remarkLatex: Plugin<[], Root> = function () {
  const data = this.data();
  (data.micromarkExtensions ??= []).push(syntax);
  (data.fromMarkdownExtensions ??= []).push(ast);
};

export default remarkLatex;
