'use client';

import {
  canDeleteSolutionReply,
  canEditSolutionReply,
  type SolutionPermissionFlags,
} from './solution-reply-permissions';
import {
  deleteProblemSolutionReply,
  editProblemSolutionReply,
  replyProblemSolution,
} from '@/api/client/method/problem/solution-reply';
import UserSpan from '@/features/user/user-span';
import DeleteConfirmPopover from '@/shared/components/delete-confirm-popover';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import ClientMarkdown from '@/shared/components/markdown/client-markdown';
import { Button } from '@/shared/components/ui/button';
import { Textarea } from '@/shared/components/ui/textarea';
import oid2ts from '@/shared/lib/oid2ts';
import type { ObjectId } from '@/shared/types/shared';
import type { BaseUserDict } from '@/shared/types/user';
import dayjs from 'dayjs';
import { Check, Pencil, Send, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  pid: string | number;
  psid: ObjectId;
  replies: {
    _id?: ObjectId;
    docId?: ObjectId;
    owner: number;
    content: string;
  }[];
  udict: BaseUserDict;
  viewerId?: number;
  permissions: SolutionPermissionFlags;
  canReply: boolean;
};

type ReplyEditFormProps = {
  label: string;
  initialContent: string;
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (content: string) => Promise<string | null>;
};

function ReplyEditForm({
  label,
  initialContent,
  disabled,
  onCancel,
  onSubmit,
}: ReplyEditFormProps) {
  const t = useTranslations('solution.replies');
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (submitting) return;
    if (!content.trim()) {
      setError(t('contentRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    const failure = await onSubmit(content);
    setSubmitting(false);
    if (failure) setError(failure);
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        disabled={disabled || submitting}
        aria-label={label}
        className="min-h-20 resize-y"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-destructive min-h-5 text-xs" data-llm-text={error}>
          {error}
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
            onClick={handleSubmit}
            disabled={disabled || submitting}
          >
            <Check strokeWidth={2} />
            <span data-llm-text={t('save')}>{t('save')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatTime(value: ObjectId) {
  const ts = oid2ts(value);
  return Number.isFinite(ts) ? dayjs(ts).format('YYYY-MM-DD HH:mm') : '';
}

export default function SolutionReplies({
  pid,
  psid,
  replies,
  udict,
  viewerId,
  permissions,
  canReply,
}: Props) {
  const t = useTranslations('solution.replies');
  const router = useRouter();
  const [editingId, setEditingId] = useState<ObjectId | null>(null);
  const [replying, setReplying] = useState(false);

  if (!replies.length && !canReply) return null;

  const handleReplySubmit = async (content: string): Promise<string | null> => {
    try {
      const response = await replyProblemSolution(pid, psid, content).send();
      if ('error' in response) return parseErrorMessage(response.error);
      setReplying(false);
      router.refresh();
      return null;
    } catch (error) {
      return error instanceof Error && error.message
        ? error.message
        : t('replyFailed');
    }
  };

  const handleEditSubmit =
    (psrid: ObjectId) =>
    async (content: string): Promise<string | null> => {
      try {
        const response = await editProblemSolutionReply(
          pid,
          psid,
          psrid,
          content
        ).send();
        if ('error' in response) return parseErrorMessage(response.error);
        setEditingId(null);
        router.refresh();
        return null;
      } catch (error) {
        return error instanceof Error && error.message
          ? error.message
          : t('replyFailed');
      }
    };

  return (
    <div className="space-y-3 border-l-2 border-dashed pl-4">
      {replies.map((reply) => {
        const owner = udict[reply.owner];
        const replyId = reply._id ?? reply.docId;
        if (!replyId) return null;
        const canEdit = canEditSolutionReply(
          permissions,
          reply.owner,
          viewerId
        );
        const canDelete = canDeleteSolutionReply(
          permissions,
          reply.owner,
          viewerId
        );
        const time = formatTime(replyId);

        return (
          <div key={replyId} className="space-y-1.5" data-llm-visible="true">
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              {owner && <UserSpan user={owner} />}
              {time && <span data-llm-text={time}>{time}</span>}
              <div className="ml-auto flex items-center gap-1">
                {canEdit && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    aria-label={t('edit')}
                    title={t('edit')}
                    onClick={() =>
                      setEditingId((current) =>
                        current === replyId ? null : replyId
                      )
                    }
                  >
                    <Pencil strokeWidth={2} />
                  </Button>
                )}
                {canDelete && (
                  <DeleteConfirmPopover
                    onDelete={async () => {
                      const response = await deleteProblemSolutionReply(
                        pid,
                        psid,
                        replyId
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

            {editingId === replyId ? (
              <ReplyEditForm
                label={t('edit')}
                initialContent={reply.content}
                disabled={false}
                onCancel={() => setEditingId(null)}
                onSubmit={handleEditSubmit(replyId)}
              />
            ) : (
              <div className="text-sm leading-6" data-llm-text={reply.content}>
                <ClientMarkdown>{reply.content}</ClientMarkdown>
              </div>
            )}
          </div>
        );
      })}

      {canReply &&
        (replying ? (
          <div className="pt-1">
            <ReplyEditForm
              label={t('replyLabel')}
              initialContent=""
              disabled={false}
              onCancel={() => setReplying(false)}
              onSubmit={handleReplySubmit}
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="gap-1.5"
            onClick={() => setReplying(true)}
          >
            <Send strokeWidth={2} />
            <span data-llm-text={t('reply')}>{t('reply')}</span>
          </Button>
        ))}
    </div>
  );
}
