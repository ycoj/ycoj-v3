'use client';

import EntityPreviewCard from '@/shared/components/entity-hover/entity-preview-card';
import {
  loadEntityPreview,
  peekEntityPreview,
} from '@/shared/components/entity-hover/load-entity-preview';
import type { EntityKind } from '@/shared/components/entity-hover/types';
import { HoverCard } from 'radix-ui';
import { Suspense, use, useMemo, type ReactElement } from 'react';

const OPEN_DELAY_MS = 400;
const CLOSE_DELAY_MS = 150;

type Props = {
  kind: EntityKind;
  id: string;
  children: ReactElement;
  openDelay?: number;
  closeDelay?: number;
};

function PreviewLoader({ kind, id }: { kind: EntityKind; id: string }) {
  const preview = useMemo(() => loadEntityPreview(kind, id), [kind, id]);
  const result = use(preview);
  return <EntityPreviewCard result={result} />;
}

function PreviewRequest({ kind, id }: { kind: EntityKind; id: string }) {
  const cached = peekEntityPreview(kind, id);
  if (cached) return <EntityPreviewCard result={cached} />;
  return <PreviewLoader kind={kind} id={id} />;
}

export default function EntityHoverCard({
  kind,
  id,
  children,
  openDelay = OPEN_DELAY_MS,
  closeDelay = CLOSE_DELAY_MS,
}: Props) {
  if (!id) return children;
  return (
    <HoverCard.Root openDelay={openDelay} closeDelay={closeDelay}>
      <HoverCard.Trigger asChild>{children}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 origin-(--radix-hover-card-content-transform-origin) outline-hidden duration-100"
        >
          <Suspense fallback={<EntityPreviewCard result={null} />}>
            <PreviewRequest kind={kind} id={id} />
          </Suspense>
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  );
}
