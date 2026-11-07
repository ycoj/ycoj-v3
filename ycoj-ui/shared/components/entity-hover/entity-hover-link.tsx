'use client';

import EntityHoverCard from '@/shared/components/entity-hover/entity-hover-card';
import { parseEntityHref } from '@/shared/components/entity-hover/parse-entity-href';
import type { EntityPreviewChrome } from '@/shared/components/entity-hover/types';
import Link from 'next/link';
import { forwardRef, type ComponentProps } from 'react';

type Props = ComponentProps<typeof Link> & {
  openDelay?: number;
  closeDelay?: number;
  chrome?: EntityPreviewChrome;
};

const EntityHoverLink = forwardRef<HTMLAnchorElement, Props>(
  function EntityHoverLink(
    { href, children, openDelay, closeDelay, chrome, ...props },
    ref
  ) {
    const reference = typeof href === 'string' ? parseEntityHref(href) : null;
    const link = (
      <Link ref={ref} href={href} {...props}>
        {children}
      </Link>
    );
    if (!reference) return link;
    return (
      <EntityHoverCard
        kind={reference.kind}
        id={reference.id}
        openDelay={openDelay}
        closeDelay={closeDelay}
        chrome={chrome}
      >
        {link}
      </EntityHoverCard>
    );
  }
);

export default EntityHoverLink;
