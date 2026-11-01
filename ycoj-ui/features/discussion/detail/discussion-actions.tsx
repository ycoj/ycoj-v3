'use client';

import ClientApis from '@/api/client/method';
import {
  canDeleteTopic,
  canEditTopic,
  canLockTopic,
  type DiscussionPermissionFlags,
} from '@/features/discussion/lib/permissions';
import DeleteConfirmPopover from '@/shared/components/delete-confirm-popover';
import { Button } from '@/shared/components/ui/button';
import type { DiscussionDoc } from '@/shared/types/discussion';
import { Lock, LockOpen, Pencil, Star, StarOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  ddoc: DiscussionDoc;
  viewerId?: number;
  permissions: DiscussionPermissionFlags;
  /** Star state of the current viewer, from `dsdoc`. */
  starred: boolean;
  /** Whether a signed-in viewer may star the topic. */
  canStar: boolean;
};

export default function DiscussionActions({
  ddoc,
  viewerId,
  permissions,
  starred,
  canStar,
}: Props) {
  const t = useTranslations('discussion.actions');
  const router = useRouter();
  const [pending, setPending] = useState<'lock' | 'star' | null>(null);
  const [error, setError] = useState('');

  const showEdit = canEditTopic(permissions, viewerId, ddoc.owner);
  const showDelete = canDeleteTopic(permissions, viewerId, ddoc.owner);
  const showLock = canLockTopic(permissions, viewerId, ddoc.owner);
  const lock = !!ddoc.lock;

  const run = async (kind: 'lock' | 'star', action: () => Promise<unknown>) => {
    if (pending) return;
    setPending(kind);
    setError('');
    try {
      await action();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message ? err.message : t('actionFailed')
      );
    } finally {
      setPending(null);
    }
  };

  const handleLock = () =>
    run('lock', async () => {
      const response = await ClientApis.Discussion.setDiscussionLock(
        ddoc.docId,
        !lock
      ).send();
      if ('error' in response) throw new Error(t('actionFailed'));
    });

  const handleStar = () =>
    run('star', async () => {
      const response = await ClientApis.Discussion.starDiscussion(
        ddoc.docId,
        !starred
      ).send();
      if ('error' in response) throw new Error(t('actionFailed'));
    });

  const lockLabel = lock ? t('unlock') : t('lock');
  const starLabel = starred ? t('unstar') : t('star');

  return (
    <div
      className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs"
      data-llm-visible="true"
    >
      {showEdit && (
        <Button asChild variant="ghost" size="xs" className="gap-1.5">
          <Link href={`/discussion/${ddoc.docId}/edit`} prefetch={false}>
            <Pencil strokeWidth={2} />
            <span data-llm-text={t('edit')}>{t('edit')}</span>
          </Link>
        </Button>
      )}
      {canStar && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="gap-1.5"
          onClick={() => void handleStar()}
          disabled={pending !== null}
          aria-pressed={starred}
        >
          {starred ? <StarOff strokeWidth={2} /> : <Star strokeWidth={2} />}
          <span data-llm-text={starLabel}>{starLabel}</span>
        </Button>
      )}
      {showLock && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="gap-1.5"
          onClick={() => void handleLock()}
          disabled={pending !== null}
          aria-pressed={lock}
        >
          {lock ? <LockOpen strokeWidth={2} /> : <Lock strokeWidth={2} />}
          <span data-llm-text={lockLabel}>{lockLabel}</span>
        </Button>
      )}
      {showDelete && (
        <DeleteConfirmPopover
          onDelete={async () => {
            const response = await ClientApis.Discussion.deleteDiscussion(
              ddoc.docId
            ).send();
            return response;
          }}
          successHref="/discussion"
          deleteLabel={t('delete')}
          confirmDeleteLabel={t('confirmDelete')}
          cancelLabel={t('cancel')}
          confirmLabel={t('confirm')}
          deletingLabel={t('deleting')}
          deleteFailedLabel={t('deleteFailed')}
        />
      )}
      {error && (
        <p
          role="alert"
          className="text-destructive text-xs"
          data-llm-text={error}
        >
          {error}
        </p>
      )}
    </div>
  );
}
