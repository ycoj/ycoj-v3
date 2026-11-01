import type { ReactNode } from 'react';

type Props = {
  /** Grid column spans (`md:col-span-*`) aligned with each rendered column. */
  spans: number[];
  columns: ReactNode[];
};

/**
 * Renders the server-configured homepage columns on a 12-column grid. Below the
 * `md` breakpoint every column stacks, which keeps narrow sidebar cards usable
 * on phones without reordering the server layout.
 */
export default function HomepageColumns({ spans, columns }: Props) {
  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12 md:gap-8">
      {columns.map((column, index) => (
        <div key={index} className={`space-y-6 ${getSpanClass(spans[index])}`}>
          {column}
        </div>
      ))}
    </div>
  );
}

/** Tailwind cannot build class names dynamically, so list the ones we use. */
const SPAN_CLASSES: Record<number, string> = {
  1: 'md:col-span-1',
  2: 'md:col-span-2',
  3: 'md:col-span-3',
  4: 'md:col-span-4',
  5: 'md:col-span-5',
  6: 'md:col-span-6',
  7: 'md:col-span-7',
  8: 'md:col-span-8',
  9: 'md:col-span-9',
  10: 'md:col-span-10',
  11: 'md:col-span-11',
  12: 'md:col-span-12',
};

function getSpanClass(span: number | undefined): string {
  return (span !== undefined && SPAN_CLASSES[span]) || SPAN_CLASSES[12];
}
