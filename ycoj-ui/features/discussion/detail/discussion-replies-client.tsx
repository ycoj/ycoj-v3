'use client';

import DiscussionHistoryPopover from './discussion-history-popover';
import DiscussionReactions from './discussion-reactions';
import ClientApis from '@/api/client/method';
import {
  canDeleteTopicReply,
  canDeleteTopicTailReply,
  canEditTopicReply,
  canEditTopicTailReply,
  type DiscussionPermissionFlags,
} from '@/features/discussion/lib/permissions';
import UserAvatar from '@/features/user/user-avatar';
import UserSpan from '@/features/user/user-span';
import DeleteConfirmPopover from '@/shared/components/delete-confirm-popover';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import ClientMarkdown from '@/shared/components/markdown/client-markdown';
import Pagination from '@/shared/components/pagination';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { Separator } from '@/shared/components/ui/separator';
import { Textarea } from '@/shared/components/ui/textarea';
import oid2ts from '@/shared/lib/oid2ts';
import type {
  DiscussionReplyDoc,
  DiscussionTailReplyDoc,
} from '@/shared/types/discussion';
import type { ObjectId } from '@/shared/types/shared';
import type { BaseUser, BaseUserDict } from '@/shared/types/user';
import dayjs from 'dayjs';
import { Check, MessageCircle, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Fragment, useState } from 'react';

type Props = {
  did: string;
  drdocs: DiscussionReplyDoc[];
  udict: BaseUserDict;
  page: number;
  pcount: number;
  currentUser: BaseUser | null;
  viewerId?: number;
  permissions: DiscussionPermissionFlags;
  topicOwner: number;
  topicLocked: boolean;
  /** Viewer's reactions keyed by `did`/`drid`, from the detail response. */
  reactions: Record<string, Record<string, number>>;
};

type ReplyTarget =
  'root' | { drid: ObjectId } | { drid: ObjectId; drrid: ObjectId };

type EditTarget =
  | { kind: 'topic-reply'; drid: ObjectId }
  | { kind: 'tail-reply'; drid: ObjectId; drrid: ObjectId };

function formatObjectIdTime(value?: ObjectId) {
  if (!value) return '';
  const ts = oid2ts(value);
  if (!Number.isFinite(ts)) return '';
  const date = dayjs(ts);
  return date.isValid() ? date.format('YYYY-MM-DD HH:mm') : '';
}

function getFloorReplyId(reply: DiscussionReplyDoc): ObjectId | undefined {
  return reply.docId || reply._id;
}

type ReplyEditorProps = {
  label: string;
  initialContent?: string;
  submittingLabel: string;
  submitLabel: string;
  submitting: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (content: string) => Promise<void>;
};

function ReplyEditor({
  label,
  initialContent = '',
  submittingLabel,
  submitLabel,
  submitting,
  error,
  onCancel,
  onSubmit,
}: ReplyEditorProps) {
  const t = useTranslations('discussion.replies');
  const [content, setContent] = useState(initialContent);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async () => {
    if (submitting) return;
    if (!content.trim()) {
      setLocalError(t('commentRequired'));
      return;
    }
    setLocalError('');
    await onSubmit(content);
  };

  return (
    <div className="space-y-2" data-llm-visible="true">
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={submitting}
        aria-label={label}
        placeholder={t('commentPlaceholder')}
        className="min-h-20 resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-destructive min-h-5 text-xs"
          data-llm-text={localError || error}
        >
          {localError || error}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={onCancel}
            disabled={submitting}
          >
            <X strokeWidth={2} />
            <span data-llm-text={t('cancel')}>{t('cancel')}</span>
          </Button>
          <Button
            type="button"
            size="xs"
            className="gap-1.5"
            onClick={() => void handleSubmit()}
            disabled={submitting}
          >
            <Check strokeWidth={2} />
            <span data-llm-text={submitting ? submittingLabel : submitLabel}>
              {submitting ? submittingLabel : submitLabel}
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function DiscussionRepliesClient({
  did,
  drdocs,
  udict,
  page,
  pcount,
  currentUser,
  viewerId,
  permissions,
  topicOwner,
  topicLocked,
  reactions,
}: Props) {
  const t = useTranslations('discussion.replies');
  const router = useRouter();
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canReply = permissions.canReply && !topicLocked;

  const perform = async (action: () => Promise<unknown>): Promise<string> => {
    setSubmitting(true);
    setError('');
    try {
      const response = await action();
      if (
        response &&
        typeof response === 'object' &&
        'error' in response &&
        response.error
      ) {
        return parseErrorMessage(
          response.error as Parameters<typeof parseErrorMessage>[0]
        );
      }
      router.refresh();
      return '';
    } catch (err) {
      return err instanceof Error && err.message
        ? err.message
        : t('replyFailed');
    } finally {
      setSubmitting(false);
    }
  };

  const submitRootReply = async (content: string) => {
    const failure = await perform(() =>
      ClientApis.Discussion.replyDiscussion(did, content).send()
    );
    if (failure) {
      setError(failure);
      return;
    }
    setTarget(null);
  };

  const submitTailReply = async (drid: ObjectId, content: string) => {
    const failure = await perform(() =>
      ClientApis.Discussion.replyDiscussionTail(did, drid, content).send()
    );
    if (failure) {
      setError(failure);
      return;
    }
    setTarget(null);
  };

  const submitEditReply = async (drid: ObjectId, content: string) => {
    const failure = await perform(() =>
      ClientApis.Discussion.editDiscussionReply(did, drid, content).send()
    );
    if (failure) {
      setError(failure);
      return;
    }
    setEditTarget(null);
  };

  const submitEditTailReply = async (
    drid: ObjectId,
    drrid: ObjectId,
    content: string
  ) => {
    const failure = await perform(() =>
      ClientApis.Discussion.editDiscussionTailReply(
        did,
        drid,
        drrid,
        content
      ).send()
    );
    if (failure) {
      setError(failure);
      return;
    }
    setEditTarget(null);
  };

  return (
    <section className="space-y-6" data-llm-visible="true">
      <Separator />

      {canReply ? (
        target === 'root' ? (
          <ReplyEditor
            label={t('commentLabel')}
            submitLabel={t('publish')}
            submittingLabel={t('publishing')}
            submitting={submitting}
            error={error}
            onCancel={() => setTarget(null)}
            onSubmit={submitRootReply}
          />
        ) : (
          <div className="text-foreground flex items-center gap-3">
            {currentUser && (
              <UserAvatar user={currentUser} className="size-10 shrink-0" />
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setError('');
                setTarget('root');
              }}
            >
              <MessageCircle strokeWidth={2} />
              <span data-llm-text={t('comment')}>{t('comment')}</span>
            </Button>
          </div>
        )
      ) : topicLocked ? (
        <p role="status" className="text-muted-foreground text-sm">
          {t('locked')}
        </p>
      ) : (
        <p role="status" className="text-muted-foreground text-sm">
          {t('noPermission')}
        </p>
      )}

      {!drdocs.length ? (
        <Empty data-llm-visible="true">
          <EmptyMedia variant="icon">
            <MessageCircle strokeWidth={2} />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle data-llm-text={t('none')}>{t('none')}</EmptyTitle>
            <EmptyDescription data-llm-text={t('noneDescription')}>
              {t('noneDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-0" data-llm-visible="true">
          {drdocs.map((floorReply) => {
            const floorId = getFloorReplyId(floorReply);
            const owner = udict[floorReply.owner!];
            const floorTime = formatObjectIdTime(
              floorReply._id || floorReply.docId
            );
            const floorTailReplies = floorReply.reply ?? [];
            const canEditReply = floorId
              ? canEditTopicReply(permissions, viewerId, floorReply.owner)
              : false;
            const canDeleteReply = floorId
              ? canDeleteTopicReply(
                  permissions,
                  viewerId,
                  floorReply.owner,
                  topicOwner
                )
              : false;
            const isEditing =
              !!floorId &&
              editTarget?.kind === 'topic-reply' &&
              editTarget.drid === floorId;
            const isReplying =
              !!floorId &&
              target !== null &&
              target !== 'root' &&
              target.drid === floorId &&
              !('drrid' in target);

            return (
              <Fragment key={floorReply.docId}>
                <article
                  id={floorId ? `reply-${floorId}` : undefined}
                  className="scroll-mt-24 space-y-3 border-t py-4"
                >
                  <div className="flex items-start gap-3">
                    {owner && (
                      <UserAvatar user={owner} className="size-10 shrink-0" />
                    )}

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                        {owner && <UserSpan user={owner} showAvatar={false} />}
                        {floorTime && (
                          <span data-llm-text={floorTime}>{floorTime}</span>
                        )}
                        {floorReply.edited && floorId && (
                          <DiscussionHistoryPopover did={did} drid={floorId} />
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {canEditReply && floorId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground"
                              aria-label={t('edit')}
                              title={t('edit')}
                              onClick={() => {
                                setError('');
                                setEditTarget({
                                  kind: 'topic-reply',
                                  drid: floorId,
                                });
                              }}
                            >
                              <Pencil strokeWidth={2} />
                            </Button>
                          )}
                          {canDeleteReply && floorId && (
                            <DeleteConfirmPopover
                              onDelete={async () => {
                                const response =
                                  await ClientApis.Discussion.deleteDiscussionReply(
                                    did,
                                    floorId
                                  ).send();
                                router.refresh();
                                return response;
                              }}
                              deleteLabel={t('delete')}
                              confirmDeleteLabel={t('confirmDelete')}
                              cancelLabel={t('cancel')}
                              confirmLabel={t('confirm')}
                              deletingLabel={t('deleting')}
                              deleteFailedLabel={t('deleteFailed')}
                            />
                          )}
                        </div>
                      </div>

                      {isEditing && floorId ? (
                        <ReplyEditor
                          label={t('editFormLabel')}
                          initialContent={floorReply.content}
                          submitLabel={t('save')}
                          submittingLabel={t('saving')}
                          submitting={submitting}
                          error={error}
                          onCancel={() => setEditTarget(null)}
                          onSubmit={(content) =>
                            submitEditReply(floorId, content)
                          }
                        />
                      ) : (
                        <div className="text-sm leading-6">
                          <ClientMarkdown>{floorReply.content}</ClientMarkdown>
                        </div>
                      )}

                      {floorId && (
                        <DiscussionReactions
                          did={did}
                          nodeType="drid"
                          id={floorId}
                          reactions={floorReply.react ?? {}}
                          ownReactions={reactions[floorId] ?? {}}
                          canReact={permissions.canReact}
                        />
                      )}

                      <div className="flex items-center gap-3">
                        {floorId && canReply && (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={() => {
                              setError('');
                              setTarget(isReplying ? null : { drid: floorId });
                            }}
                          >
                            <span
                              data-llm-text={
                                isReplying ? t('cancelReply') : t('reply')
                              }
                            >
                              {isReplying ? t('cancelReply') : t('reply')}
                            </span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {(floorTailReplies.length > 0 || isReplying) && (
                    <div className="ml-12 space-y-3 border-l-2 border-dashed pl-4">
                      {floorTailReplies.map((tailReply) => (
                        <TailReplyItem
                          key={tailReply._id}
                          did={did}
                          drid={floorId!}
                          tailReply={tailReply}
                          owner={udict[tailReply.owner]}
                          permissions={permissions}
                          viewerId={viewerId}
                          submitting={submitting}
                          error={error}
                          editTarget={editTarget}
                          onCancelEdit={() => setEditTarget(null)}
                          onEdit={(content) =>
                            submitEditTailReply(
                              floorId!,
                              tailReply._id,
                              content
                            )
                          }
                          onStartEdit={() => {
                            setError('');
                            setEditTarget({
                              kind: 'tail-reply',
                              drid: floorId!,
                              drrid: tailReply._id,
                            });
                          }}
                        />
                      ))}

                      {isReplying && floorId && (
                        <ReplyEditor
                          label={t('replyFormLabel')}
                          submitLabel={t('reply')}
                          submittingLabel={t('replying')}
                          submitting={submitting}
                          error={error}
                          onCancel={() => setTarget(null)}
                          onSubmit={(content) =>
                            submitTailReply(floorId, content)
                          }
                        />
                      )}
                    </div>
                  )}
                </article>
              </Fragment>
            );
          })}
        </div>
      )}

      <div className="pt-1">
        <Pagination page={page} totalPages={pcount} />
      </div>
    </section>
  );
}

type TailReplyItemProps = {
  did: string;
  drid: ObjectId;
  tailReply: DiscussionTailReplyDoc;
  owner?: BaseUser;
  permissions: DiscussionPermissionFlags;
  viewerId?: number;
  submitting: boolean;
  error: string;
  editTarget: EditTarget | null;
  onCancelEdit: () => void;
  onEdit: (content: string) => Promise<void>;
  onStartEdit: () => void;
};

function TailReplyItem({
  did,
  drid,
  tailReply,
  owner,
  permissions,
  viewerId,
  submitting,
  error,
  editTarget,
  onCancelEdit,
  onEdit,
  onStartEdit,
}: TailReplyItemProps) {
  const t = useTranslations('discussion.replies');
  const router = useRouter();
  const tailTime = formatObjectIdTime(tailReply._id);
  const canEdit = canEditTopicTailReply(permissions, viewerId, tailReply.owner);
  const canDelete = canDeleteTopicTailReply(
    permissions,
    viewerId,
    tailReply.owner
  );
  const isEditing =
    editTarget?.kind === 'tail-reply' && editTarget.drrid === tailReply._id;

  return (
    <div className="space-y-1.5" data-llm-visible="true">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        {owner && <UserSpan user={owner} />}
        {tailTime && <span data-llm-text={tailTime}>{tailTime}</span>}
        {tailReply.edited && (
          <DiscussionHistoryPopover
            did={did}
            drid={drid}
            drrid={tailReply._id}
          />
        )}
        <div className="ml-auto flex items-center gap-1">
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={t('edit')}
              title={t('edit')}
              onClick={onStartEdit}
            >
              <Pencil strokeWidth={2} />
            </Button>
          )}
          {canDelete && (
            <DeleteConfirmPopover
              onDelete={async () => {
                const response =
                  await ClientApis.Discussion.deleteDiscussionTailReply(
                    did,
                    drid,
                    tailReply._id
                  ).send();
                router.refresh();
                return response;
              }}
              deleteLabel={t('delete')}
              confirmDeleteLabel={t('confirmDelete')}
              cancelLabel={t('cancel')}
              confirmLabel={t('confirm')}
              deletingLabel={t('deleting')}
              deleteFailedLabel={t('deleteFailed')}
            />
          )}
        </div>
      </div>
      {isEditing ? (
        <ReplyEditor
          label={t('editFormLabel')}
          initialContent={tailReply.content}
          submitLabel={t('save')}
          submittingLabel={t('saving')}
          submitting={submitting}
          error={error}
          onCancel={onCancelEdit}
          onSubmit={onEdit}
        />
      ) : (
        <div className="text-sm leading-6">
          <ClientMarkdown>{tailReply.content}</ClientMarkdown>
        </div>
      )}
    </div>
  );
}
