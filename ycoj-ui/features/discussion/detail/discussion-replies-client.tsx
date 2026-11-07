'use client';

import DiscussionHistoryPopover from './discussion-history-popover';
import DiscussionReactions from './discussion-reactions';
import ClientApis from '@/api/client/method';
import DiscussionTime from '@/features/discussion/discussion-time';
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
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { Textarea } from '@/shared/components/ui/textarea';
import oid2ts from '@/shared/lib/oid2ts';
import type {
  DiscussionReplyDoc,
  DiscussionTailReplyDoc,
} from '@/shared/types/discussion';
import type { ObjectId } from '@/shared/types/shared';
import type { BaseUser, BaseUserDict } from '@/shared/types/user';
import { Check, Lock, MessageCircle, Pencil, Reply, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

type Props = {
  did: string;
  drdocs: DiscussionReplyDoc[];
  udict: BaseUserDict;
  page: number;
  pcount: number;
  /** Total number of top-level replies across all pages. */
  replyCount: number;
  currentUser: BaseUser | null;
  viewerId?: number;
  permissions: DiscussionPermissionFlags;
  topicOwner: number;
  topicLocked: boolean;
  /** Viewer's reactions keyed by `did`/`drid`, from the detail response. */
  reactions: Record<string, Record<string, number>>;
};

type EditTarget =
  | { kind: 'topic-reply'; drid: ObjectId }
  | { kind: 'tail-reply'; drid: ObjectId; drrid: ObjectId };

/** Identifies the editor a failure message belongs to. */
type ErrorScope = 'root' | `reply:${string}` | `edit:${string}`;

type Failure = { scope: ErrorScope; message: string };

/** Replies carry no timestamp field; the creation time is in the ObjectId. */
function objectIdDate(value?: ObjectId): Date | null {
  if (!value) return null;
  const ts = oid2ts(value);
  return Number.isFinite(ts) ? new Date(ts) : null;
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
  /** Omit for the always-open composer, which has nothing to dismiss. */
  onCancel?: () => void;
  /** Resolves to whether the content was accepted. */
  onSubmit: (content: string) => Promise<boolean>;
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
    if (await onSubmit(content)) setContent(initialContent);
  };

  const message = localError || error;

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
          role={message ? 'alert' : undefined}
          className="text-destructive min-h-5 text-xs"
          data-llm-text={message}
        >
          {message}
        </p>
        <div className="flex gap-2">
          {onCancel && (
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
          )}
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

type ReplyHeaderProps = {
  owner?: BaseUser;
  isTopicOwner: boolean;
  time: Date | null;
  /** Shows the avatar beside the name; floor replies draw it separately. */
  withAvatar?: boolean;
  history?: ReactNode;
  actions?: ReactNode;
};

function ReplyHeader({
  owner,
  isTopicOwner,
  time,
  withAvatar = false,
  history,
  actions,
}: ReplyHeaderProps) {
  const t = useTranslations('discussion.replies');

  return (
    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {owner && <UserSpan user={owner} showAvatar={withAvatar} />}
      {isTopicOwner && (
        <Badge variant="secondary" data-llm-text={t('author')}>
          {t('author')}
        </Badge>
      )}
      {time && <DiscussionTime value={time} />}
      {history}
      {actions && (
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      )}
    </div>
  );
}

export default function DiscussionRepliesClient({
  did,
  drdocs,
  udict,
  page,
  pcount,
  replyCount,
  currentUser,
  viewerId,
  permissions,
  topicOwner,
  topicLocked,
  reactions,
}: Props) {
  const t = useTranslations('discussion.replies');
  const router = useRouter();
  const [replyingTo, setReplyingTo] = useState<ObjectId | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const canReply = permissions.canReply && !topicLocked;
  const errorFor = (scope: ErrorScope) =>
    failure?.scope === scope ? failure.message : '';

  const perform = async (
    scope: ErrorScope,
    action: () => Promise<unknown>
  ): Promise<boolean> => {
    setSubmitting(true);
    setFailure(null);
    try {
      const response = await action();
      if (
        response &&
        typeof response === 'object' &&
        'error' in response &&
        response.error
      ) {
        setFailure({
          scope,
          message: parseErrorMessage(
            response.error as Parameters<typeof parseErrorMessage>[0]
          ),
        });
        return false;
      }
      router.refresh();
      return true;
    } catch (err) {
      setFailure({
        scope,
        message:
          err instanceof Error && err.message ? err.message : t('replyFailed'),
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  const submitRootReply = (content: string) =>
    perform('root', () =>
      ClientApis.Discussion.replyDiscussion(did, content).send()
    );

  const submitTailReply = async (drid: ObjectId, content: string) => {
    const ok = await perform(`reply:${drid}`, () =>
      ClientApis.Discussion.replyDiscussionTail(did, drid, content).send()
    );
    if (ok) setReplyingTo(null);
    return ok;
  };

  const submitEditReply = async (drid: ObjectId, content: string) => {
    const ok = await perform(`edit:${drid}`, () =>
      ClientApis.Discussion.editDiscussionReply(did, drid, content).send()
    );
    if (ok) setEditTarget(null);
    return ok;
  };

  const submitEditTailReply = async (
    drid: ObjectId,
    drrid: ObjectId,
    content: string
  ) => {
    const ok = await perform(`edit:${drrid}`, () =>
      ClientApis.Discussion.editDiscussionTailReply(
        did,
        drid,
        drrid,
        content
      ).send()
    );
    if (ok) setEditTarget(null);
    return ok;
  };

  return (
    <section className="space-y-5" data-llm-visible="true">
      <h2
        className="text-lg font-semibold"
        data-llm-text={t('heading', { count: replyCount })}
      >
        {t('heading', { count: replyCount })}
      </h2>

      {canReply ? (
        <div className="bg-card flex gap-3 rounded-xl border p-5 sm:p-6">
          {currentUser && (
            <UserAvatar user={currentUser} className="size-10 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <ReplyEditor
              label={t('commentLabel')}
              submitLabel={t('publish')}
              submittingLabel={t('publishing')}
              submitting={submitting}
              error={errorFor('root')}
              onSubmit={submitRootReply}
            />
          </div>
        </div>
      ) : (
        <p
          role="status"
          className="text-muted-foreground bg-muted/40 flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-sm"
        >
          {topicLocked && <Lock className="size-4 shrink-0" />}
          <span>{topicLocked ? t('locked') : t('noPermission')}</span>
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
        <div className="space-y-3" data-llm-visible="true">
          {drdocs.map((floorReply) => {
            const floorId = getFloorReplyId(floorReply);
            const owner = udict[floorReply.owner!];
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
            const isReplying = !!floorId && replyingTo === floorId;

            return (
              <article
                key={floorReply.docId}
                id={floorId ? `reply-${floorId}` : undefined}
                className="bg-card scroll-mt-24 rounded-xl border p-5 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  {owner && (
                    <UserAvatar user={owner} className="size-10 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1 space-y-3">
                    <ReplyHeader
                      owner={owner}
                      isTopicOwner={floorReply.owner === topicOwner}
                      time={objectIdDate(floorReply._id || floorReply.docId)}
                      history={
                        floorReply.edited &&
                        floorId && (
                          <DiscussionHistoryPopover did={did} drid={floorId} />
                        )
                      }
                      actions={
                        <>
                          {canEditReply && floorId && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="text-muted-foreground"
                              aria-label={t('edit')}
                              title={t('edit')}
                              onClick={() => {
                                setFailure(null);
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
                        </>
                      }
                    />

                    {isEditing && floorId ? (
                      <ReplyEditor
                        label={t('editFormLabel')}
                        initialContent={floorReply.content}
                        submitLabel={t('save')}
                        submittingLabel={t('saving')}
                        submitting={submitting}
                        error={errorFor(`edit:${floorId}`)}
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <DiscussionReactions
                          did={did}
                          nodeType="drid"
                          id={floorId}
                          reactions={floorReply.react ?? {}}
                          ownReactions={reactions[floorId] ?? {}}
                          canReact={permissions.canReact}
                        />
                        {canReply && (
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            className="text-muted-foreground ml-auto gap-1.5"
                            onClick={() => {
                              setFailure(null);
                              setReplyingTo(isReplying ? null : floorId);
                            }}
                          >
                            <Reply strokeWidth={2} />
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
                    )}

                    {floorId && (floorTailReplies.length > 0 || isReplying) && (
                      <div className="bg-muted/40 space-y-3 rounded-lg p-3">
                        {floorTailReplies.map((tailReply) => (
                          <div
                            key={tailReply._id}
                            className="not-first:border-t not-first:pt-3"
                          >
                            <TailReplyItem
                              did={did}
                              drid={floorId}
                              tailReply={tailReply}
                              owner={udict[tailReply.owner]}
                              isTopicOwner={tailReply.owner === topicOwner}
                              permissions={permissions}
                              viewerId={viewerId}
                              submitting={submitting}
                              error={errorFor(`edit:${tailReply._id}`)}
                              editTarget={editTarget}
                              onCancelEdit={() => setEditTarget(null)}
                              onEdit={(content) =>
                                submitEditTailReply(
                                  floorId,
                                  tailReply._id,
                                  content
                                )
                              }
                              onStartEdit={() => {
                                setFailure(null);
                                setEditTarget({
                                  kind: 'tail-reply',
                                  drid: floorId,
                                  drrid: tailReply._id,
                                });
                              }}
                            />
                          </div>
                        ))}

                        {isReplying && (
                          <div className="not-first:border-t not-first:pt-3">
                            <ReplyEditor
                              label={t('replyFormLabel')}
                              submitLabel={t('reply')}
                              submittingLabel={t('replying')}
                              submitting={submitting}
                              error={errorFor(`reply:${floorId}`)}
                              onCancel={() => setReplyingTo(null)}
                              onSubmit={(content) =>
                                submitTailReply(floorId, content)
                              }
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </article>
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
  isTopicOwner: boolean;
  permissions: DiscussionPermissionFlags;
  viewerId?: number;
  submitting: boolean;
  error: string;
  editTarget: EditTarget | null;
  onCancelEdit: () => void;
  onEdit: (content: string) => Promise<boolean>;
  onStartEdit: () => void;
};

function TailReplyItem({
  did,
  drid,
  tailReply,
  owner,
  isTopicOwner,
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
      <ReplyHeader
        owner={owner}
        isTopicOwner={isTopicOwner}
        time={objectIdDate(tailReply._id)}
        withAvatar
        history={
          tailReply.edited && (
            <DiscussionHistoryPopover
              did={did}
              drid={drid}
              drrid={tailReply._id}
            />
          )
        }
        actions={
          <>
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
          </>
        }
      />
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
