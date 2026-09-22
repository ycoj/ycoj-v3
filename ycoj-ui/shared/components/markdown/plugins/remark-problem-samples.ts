type MdastNode = {
  type: string;
  children?: MdastNode[];
  [key: string]: unknown;
};

type MdastCode = MdastNode & {
  type: 'code';
  lang?: string | null;
  value?: string;
};

const INPUT_RE = /^input(\d+)$/i;
const OUTPUT_RE = /^output(\d+)$/i;

function parseSampleInfo(lang?: string | null): null | {
  kind: 'input' | 'output';
  index: number;
} {
  if (!lang) return null;
  const inputMatch = INPUT_RE.exec(lang);
  if (inputMatch) {
    return { kind: 'input', index: Number.parseInt(inputMatch[1]!, 10) };
  }
  const outputMatch = OUTPUT_RE.exec(lang);
  if (outputMatch) {
    return { kind: 'output', index: Number.parseInt(outputMatch[1]!, 10) };
  }
  return null;
}

function makeSampleNode(
  index: number,
  input: string,
  output: string
): MdastNode {
  return {
    type: 'paragraph',
    children: [],
    data: {
      hName: 'samples',
      hProperties: {
        'data-index': String(index),
        'data-input': encodeURIComponent(input),
        'data-output': encodeURIComponent(output),
      },
    },
  };
}

function transformNode(node: MdastNode) {
  if (!node.children || node.children.length === 0) return;

  const { children } = node;
  for (let i = 0; i < children.length - 1; i += 1) {
    const current = children[i] as MdastNode;
    if (current.type !== 'code') continue;

    const currentInfo = parseSampleInfo((current as MdastCode).lang);
    if (!currentInfo) continue;

    const next = children[i + 1] as MdastNode;
    if (next.type !== 'code') continue;
    const nextInfo = parseSampleInfo((next as MdastCode).lang);
    if (!nextInfo) continue;

    if (currentInfo.index !== nextInfo.index) continue;
    if (currentInfo.kind === nextInfo.kind) continue;

    const input =
      currentInfo.kind === 'input'
        ? ((current as MdastCode).value ?? '')
        : ((next as MdastCode).value ?? '');
    const output =
      currentInfo.kind === 'output'
        ? ((current as MdastCode).value ?? '')
        : ((next as MdastCode).value ?? '');

    const sampleNode = makeSampleNode(currentInfo.index, input, output);
    children.splice(i, 2, sampleNode);
  }

  for (const child of children) {
    transformNode(child as MdastNode);
  }
}

export default function remarkProblemSamples() {
  return (tree: MdastNode) => {
    transformNode(tree);
  };
}
