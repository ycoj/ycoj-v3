import { cn } from '@/shared/lib/utils';
import type { ReactNode } from 'react';

// Tailwind's preflight makes images block-level, so text-align cannot move
// them; auto margins are what actually aligns images inside the container.
const ALIGN_CLASSNAMES = {
  center: 'text-center [&_img]:mx-auto',
  left: 'text-left',
  right: 'text-right [&_img]:ml-auto',
} as const;
type AlignValue = keyof typeof ALIGN_CLASSNAMES;

type Props = {
  node?: unknown;
  className?: string;
  children?: ReactNode;
};

function getPropValue(
  props: Record<string, unknown>,
  kebabName: string,
  camelName: string
): unknown {
  return props[kebabName] ?? props[camelName];
}

function isAlignValue(value: unknown): value is AlignValue {
  return typeof value === 'string' && Object.hasOwn(ALIGN_CLASSNAMES, value);
}

export default function MarkdownAlign({
  className,
  children,
  ...props
}: Props) {
  const raw = getPropValue(
    props as Record<string, unknown>,
    'data-align',
    'dataAlign'
  );
  const align = isAlignValue(raw) ? raw : 'center';

  return (
    <div className={cn(ALIGN_CLASSNAMES[align], className)}>{children}</div>
  );
}
