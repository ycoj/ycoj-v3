import type { Processor } from 'unified';

type MdastNode = {
  type: string;
  children?: MdastNode[];
  data?: Record<string, unknown>;
  position?: {
    start?: { offset?: number };
    end?: { offset?: number };
  };
  value?: string;
};

type ParseSource = (source: string) => MdastNode;

type AlignValue = 'center' | 'left' | 'right';
type AlertVariant = 'error' | 'info' | 'success' | 'warning';
type ContainerState = 'closed' | 'opened';

// {open}/{close} are accepted spellings of {opened}/{closed}.
const CONTAINER_STATES = {
  close: 'closed',
  closed: 'closed',
  open: 'opened',
  opened: 'opened',
} as const;

const DIRECTIVE_RE =
  /^:::\s*(?:align\s*\{\s*(center|right|left)\s*\}|(info|warning|success|error))\s*(?:\[(.*)\])?\s*(?:\{(opened|closed|open|close)\})?\s*$/i;
const CLOSING_RE = /^\s*:::\s*$/;
const BLOCKQUOTE_MARKER_RE = /^[ \t]*(?:>[ \t]?)+/;
const LEADING_WHITESPACE_RE = /^[ \t]*/;

type ContainerDirective =
  | { align: AlignValue; kind: 'align' }
  | {
      kind: 'alert';
      state: ContainerState | null;
      title: string | null;
      variant: AlertVariant;
    };

// A locally parsed body has already resolved its containers against its own
// source. Never interpret its offsets against an enclosing document.
function isBuiltContainer(node: MdastNode): boolean {
  return node.data?.hName === 'md-alert' || node.data?.hName === 'md-align';
}

function getParagraphText(node: MdastNode): null | string {
  if (node.type !== 'paragraph' || !node.children) return null;
  let value = '';
  for (const child of node.children) {
    if (child.type !== 'text' || typeof child.value !== 'string') return null;
    value += child.value;
  }
  return value;
}

// Continuation lines of formulas and code spans belong to their literal node,
// even when their source looks like a container opening or closing marker.
function literalLines(node: MdastNode, source: string): Set<number> {
  const lines = new Set<number>();
  const start = node.position?.start?.offset;
  if (start === undefined) return lines;
  const collect = (child: MdastNode) => {
    if (child.type !== 'latex' && child.type !== 'inlineCode') {
      child.children?.forEach(collect);
      return;
    }
    const from = child.position?.start?.offset;
    const to = child.position?.end?.offset;
    if (from === undefined || to === undefined) return;
    const firstLine = source.slice(start, from).split(/\r\n?|\n/).length - 1;
    const lastLine = source.slice(start, to).split(/\r\n?|\n/).length - 1;
    for (let line = firstLine + 1; line <= lastLine; line += 1) {
      lines.add(line);
    }
  };
  node.children?.forEach(collect);
  return lines;
}

// Paragraph source slices keep the blockquote markers and list indentation of
// their container on continuation lines, so they cannot be parsed as a
// standalone document until those prefixes are removed. Falls back to the
// plain text for synthetic trees without position info.
function getNodeSource(node: MdastNode, source: string): null | string {
  const start = node.position?.start?.offset;
  const end = node.position?.end?.offset;
  if (typeof start === 'number' && typeof end === 'number') {
    return normalizeParagraphSource(node, source, source.slice(start, end));
  }
  return getParagraphText(node);
}

// Returns the paragraph source as if it was written at the top level: quote
// markers are stripped and continuation lines are dedented to the paragraph's
// own content column, so compact bodies keep their markdown.
function normalizeParagraphSource(
  node: MdastNode,
  source: string,
  paragraphSource: string
): string {
  const lines = paragraphSource
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(BLOCKQUOTE_MARKER_RE, ''));

  const start = node.position?.start?.offset;
  let structuralIndent = 0;
  if (typeof start === 'number') {
    const lineStart = source.lastIndexOf('\n', start - 1) + 1;
    structuralIndent = source
      .slice(lineStart, start)
      .replace(BLOCKQUOTE_MARKER_RE, '').length;
  }

  // Lazy continuation lines may be indented less than the list marker, so the
  // dedent is clamped to the shallowest continuation line to keep content.
  let dedent = structuralIndent;
  for (let index = 1; index < lines.length; index += 1) {
    const leading = LEADING_WHITESPACE_RE.exec(lines[index]!)?.[0].length ?? 0;
    if (leading < dedent) dedent = leading;
  }

  return lines
    .map((line, index) => (index === 0 ? line : line.slice(dedent)))
    .join('\n');
}

function parseDirective(line: string): ContainerDirective | null {
  const match = DIRECTIVE_RE.exec(line);
  if (!match) return null;

  if (match[1]) {
    // A title and a collapse marker only make sense for alert containers.
    if (match[3] !== undefined || match[4] !== undefined) return null;
    return { align: match[1].toLowerCase() as AlignValue, kind: 'align' };
  }

  const title = match[3]?.trim();
  return {
    kind: 'alert',
    state: match[4]
      ? CONTAINER_STATES[
          match[4].toLowerCase() as keyof typeof CONTAINER_STATES
        ]
      : null,
    title: title ? title : null,
    variant: match[2]!.toLowerCase() as AlertVariant,
  };
}

function makeContainerNode(
  directive: ContainerDirective,
  children: MdastNode[]
): MdastNode {
  if (directive.kind === 'align') {
    return {
      type: 'container',
      children,
      data: {
        hName: 'md-align',
        hProperties: { 'data-align': directive.align },
      },
    };
  }
  return {
    type: 'container',
    children,
    data: {
      hName: 'md-alert',
      hProperties: {
        'data-variant': directive.variant,
        ...(directive.title ? { 'data-title': directive.title } : {}),
        ...(directive.state ? { 'data-state': directive.state } : {}),
      },
    },
  };
}

// Finds the closing line matching the opening directive on lines[from],
// skipping over nested container directives, or -1 when the rest of the
// paragraph holds no match.
function findClosingLine(
  lines: string[],
  from: number,
  literals: ReadonlySet<number>
): number {
  let depth = 1;
  for (let index = from + 1; index < lines.length; index += 1) {
    if (literals.has(index)) continue;
    const line = lines[index]!;
    if (parseDirective(line)) {
      depth += 1;
    } else if (CLOSING_RE.test(line)) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

// Resolve containers before the other remark transforms. Every body then
// reaches the PDF and sample transforms once, as part of the completed tree.
function parseInnerChildren(
  body: string,
  parseSource: ParseSource
): MdastNode[] {
  const innerTree = parseSource(body);
  transformNode(innerTree, body, parseSource);
  return innerTree.children ?? [];
}

type Frame = {
  collected: MdastNode[];
  directive: ContainerDirective;
  // Raw source from the directive line to the end of its paragraph. A frame
  // that starts after other content in the same paragraph restores only this
  // slice on fallback, since the content before it was already emitted.
  literalText: string;
  // The original paragraph node, restored verbatim when the frame starts at
  // the paragraph's first line.
  opening: MdastNode;
  // Index of the directive line inside its paragraph; 0 when the frame owns
  // the whole paragraph.
  startLine: number;
  // Lines that followed the opening marker inside its own paragraph,
  // re-parsed into nodes. They render inside the opening paragraph, so an
  // unterminated frame drops them on restore instead of double-emitting.
  tail: MdastNode[] | null;
};

function transformNode(
  node: MdastNode,
  source: string,
  parseSource: ParseSource
) {
  const children = node.children;
  if (!children || children.length === 0) return;

  const result: MdastNode[] = [];
  const frames: Frame[] = [];

  const pushContent = (item: MdastNode) => {
    const frame = frames[frames.length - 1];
    if (frame) frame.collected.push(item);
    else result.push(item);
  };

  // Both the tail and collected siblings are already resolved. Closing a
  // frame only groups them; it never parses or traverses their bodies again.
  const closeFrame = (frame: Frame) => {
    pushContent(
      makeContainerNode(frame.directive, [
        ...(frame.tail ?? []),
        ...frame.collected,
      ])
    );
  };

  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]!;
    const text =
      child.type === 'paragraph' ? getNodeSource(child, source) : null;

    if (text === null) {
      if (!isBuiltContainer(child)) transformNode(child, source, parseSource);
      pushContent(child);
      continue;
    }

    const lines = text.split('\n');
    const literals = literalLines(child, source);
    const opensFrame = lines.some(
      (line, index) => !literals.has(index) && parseDirective(line) !== null
    );
    const closesFrame =
      frames.length > 0 &&
      lines.some(
        (line, index) => !literals.has(index) && CLOSING_RE.test(line)
      );
    if (!opensFrame && !closesFrame) {
      pushContent(child);
      continue;
    }

    // Container markers only need to sit on their own line, so a paragraph may
    // mix them with other content. Walk the lines and emit every plain run,
    // container, and frame in the order it appears.
    let cursor = 0;
    let plainStart = 0;
    const flushPlain = (end: number) => {
      if (plainStart >= end) return;
      const body = lines.slice(plainStart, end).join('\n');
      plainStart = end;
      for (const item of parseInnerChildren(body, parseSource)) {
        pushContent(item);
      }
    };

    while (cursor < lines.length) {
      const line = lines[cursor]!;
      if (literals.has(cursor)) {
        cursor += 1;
        continue;
      }
      const directive = parseDirective(line);

      if (directive) {
        flushPlain(cursor);
        const closingLine = findClosingLine(lines, cursor, literals);
        if (closingLine !== -1) {
          pushContent(
            makeContainerNode(
              directive,
              parseInnerChildren(
                lines.slice(cursor + 1, closingLine).join('\n'),
                parseSource
              )
            )
          );
          cursor = closingLine + 1;
        } else {
          const rest = lines.slice(cursor + 1);
          frames.push({
            collected: [],
            directive,
            literalText: lines.slice(cursor).join('\n'),
            opening: child,
            startLine: cursor,
            tail: rest.length
              ? parseInnerChildren(rest.join('\n'), parseSource)
              : null,
          });
          cursor = lines.length;
        }
        plainStart = cursor;
        continue;
      }

      if (CLOSING_RE.test(line) && frames.length > 0) {
        flushPlain(cursor);
        closeFrame(frames.pop()!);
        cursor += 1;
        plainStart = cursor;
        continue;
      }

      cursor += 1;
    }
    flushPlain(lines.length);
  }

  // An unterminated frame restores its opening paragraph. Siblings and
  // complete inner containers have already been resolved and remain visible.
  for (const frame of frames) {
    if (frame.startLine === 0) {
      result.push(frame.opening, ...frame.collected);
    } else {
      // Content in front of the directive was already emitted, so restoring
      // the whole paragraph would duplicate it.
      result.push(
        ...parseInnerChildren(frame.literalText, parseSource),
        ...frame.collected
      );
    }
  }

  node.children = result;
}

export default function remarkContainers(this: Processor) {
  return (tree: MdastNode, file: { toString: () => string }) => {
    transformNode(
      tree,
      String(file),
      (source) => this.parse(source) as MdastNode
    );
  };
}
