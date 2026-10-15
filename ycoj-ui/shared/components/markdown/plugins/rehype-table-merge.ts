import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

type Cell = {
  node: Element;
  column: number;
  row: number;
  width: number;
  height: number;
  marker: string | null;
};

function mergeMarker(cell: Element) {
  if (cell.children.length !== 1) return null;
  const child = cell.children[0];
  if (child.type !== 'text') return null;
  const value = child.value.trim();
  return value === '^' || value === '<' ? value : null;
}

function mergeRows(rows: Element[]) {
  let above: Cell[] = [];

  for (const [rowIndex, row] of rows.entries()) {
    const cells = row.children.filter(
      (child): child is Element =>
        child.type === 'element' &&
        (child.tagName === 'td' || child.tagName === 'th')
    );
    const markers = cells.map(mergeMarker);
    const current: Cell[] = [];
    const removed = new Set<Element>();

    for (let column = 0; column < cells.length; column += 1) {
      const node = cells[column];
      const marker = markers[column];
      const upper = above[column];
      const left = current[column - 1];

      // A vertical continuation must cover the entire width of its origin.
      // Partial spans would make the browser shift later cells to new columns.
      if (
        marker === '^' &&
        upper &&
        upper.marker === null &&
        upper.column === column &&
        column + upper.width <= cells.length &&
        markers
          .slice(column, column + upper.width)
          .every((value) => value === '^' || value === '<')
      ) {
        upper.height += 1;
        upper.node.properties.rowSpan = upper.height;
        for (let offset = 0; offset < upper.width; offset += 1) {
          current[column + offset] = upper;
          removed.add(cells[column + offset]);
        }
        column += upper.width - 1;
      } else if (
        marker === '<' &&
        left &&
        left.marker === null &&
        left.row === rowIndex
      ) {
        left.width += 1;
        left.node.properties.colSpan = left.width;
        current[column] = left;
        removed.add(node);
      } else {
        current[column] = {
          node,
          column,
          row: rowIndex,
          width: 1,
          height: 1,
          marker,
        };
      }
    }

    row.children = row.children.filter(
      (child) => child.type !== 'element' || !removed.has(child)
    );
    above = current;
  }
}

const rehypeTableMerge: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'element', (table) => {
    if (table.tagName !== 'table') return;
    for (const group of table.children) {
      if (
        group.type !== 'element' ||
        (group.tagName !== 'thead' && group.tagName !== 'tbody')
      ) {
        continue;
      }
      mergeRows(
        group.children.filter(
          (child): child is Element =>
            child.type === 'element' && child.tagName === 'tr'
        )
      );
    }
  });
};

export default rehypeTableMerge;
