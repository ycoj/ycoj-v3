import type { Element } from 'hast';

export function createFormulaHost(value: string, display: boolean): Element {
  return {
    type: 'element',
    tagName: 'span',
    properties: {
      'data-math-source': value,
      'data-math-display': String(display),
    },
    children: [{ type: 'text', value }],
  };
}
