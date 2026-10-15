import type { Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const remarkCuteTable: Plugin<[], Root> = () => (tree) => {
  visit(tree, 'table', (table, index, parent) => {
    if (!parent || index === undefined || index === 0) return;
    const marker = parent.children[index - 1];
    if (
      marker.type !== 'paragraph' ||
      marker.children.length !== 1 ||
      marker.children[0].type !== 'text' ||
      marker.children[0].value.trim() !== '::cute-table{tuack}'
    ) {
      return;
    }

    table.data = {
      ...table.data,
      hProperties: {
        ...table.data?.hProperties,
        className: ['cute-table-tuack'],
      },
    };
    parent.children.splice(index - 1, 1);
    return index - 1;
  });
};

export default remarkCuteTable;
