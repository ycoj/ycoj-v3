'use client';

import EntityHoverCard from '@/shared/components/entity-hover/entity-hover-card';
import { parseEntityHref } from '@/shared/components/entity-hover/parse-entity-href';
import type { ComponentProps } from 'react';

type Props = ComponentProps<'a'> & {
  node?: unknown;
};

export default function MarkdownEntityLink({
  href,
  node,
  children,
  ...props
}: Props) {
  void node;
  const reference = typeof href === 'string' ? parseEntityHref(href) : null;
  const anchor = (
    <a href={href} {...props}>
      {children}
    </a>
  );
  if (!reference) return anchor;
  return (
    <EntityHoverCard kind={reference.kind} id={reference.id}>
      {anchor}
    </EntityHoverCard>
  );
}
