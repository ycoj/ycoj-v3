import SolutionCopyLink from './solution-copy-link';
import SolutionDeleteButton from './solution-delete-button';
import SolutionReplies from './solution-replies';
import {
  canManageSolution,
  type SolutionPermissionFlags,
} from './solution-reply-permissions';
import SolutionStatus from './solution-status';
import SolutionVote from './solution-vote';
import UserSpan from '@/features/user/user-span';
import EntityHoverLink from '@/shared/components/entity-hover/entity-hover-link';
import Markdown from '@/shared/components/markdown';
import { Button } from '@/shared/components/ui/button';
import oid2ts from '@/shared/lib/oid2ts';
import { cn } from '@/shared/lib/utils';
import type { SolutionDoc } from '@/shared/types/problem';
import type { ObjectId } from '@/shared/types/shared';
import type { BaseUserDict } from '@/shared/types/user';
import dayjs from 'dayjs';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  solution: SolutionDoc;
  udict: BaseUserDict;
  pssdict: Record<string, { docId: ObjectId; vote: number }>;
  pid: string | number;
  viewerId?: number;
  allowEditAny: boolean;
  allowEditSelf: boolean;
  allowDeleteAny: boolean;
  allowDeleteSelf: boolean;
  allowReply?: boolean;
  allowEditReplySelf?: boolean;
  allowDeleteReplyAny?: boolean;
  allowDeleteReplySelf?: boolean;
  /** Backend label for `solution.reviewStatus`, forwarded to the status badge. */
  reviewLabel?: string;
  /** Emphasize the entry opened through its permalink. */
  highlighted?: boolean;
};

export default function SolutionItem({
  solution,
  udict,
  pssdict,
  pid,
  viewerId,
  allowEditAny,
  allowEditSelf,
  allowDeleteAny,
  allowDeleteSelf,
  allowReply = false,
  allowEditReplySelf = false,
  allowDeleteReplyAny = false,
  allowDeleteReplySelf = false,
  reviewLabel,
  highlighted = false,
}: Props) {
  const t = useTranslations('solution');
  const user = udict[solution.owner];
  const vote = solution.vote;
  const userVote = (pssdict[solution.docId]?.vote ?? 0) as 0 | 1 | -1;
  const createdAtMs = oid2ts(solution._id);
  const createdAt = Number.isFinite(createdAtMs)
    ? dayjs(createdAtMs).format('YYYY/MM/DD HH:mm')
    : '';
  const permissions: SolutionPermissionFlags = {
    allowEditAny,
    allowEditSelf,
    allowDeleteAny,
    allowDeleteSelf,
    allowReply,
    allowEditReplySelf,
    allowDeleteReplyAny,
    allowDeleteReplySelf,
  };
  const { canEdit, canDelete } = canManageSolution(
    permissions,
    solution.owner,
    viewerId
  );
  // Blocked solution authors may still reply; `postReply` only checks the reply permission.
  const canReply = permissions.allowReply;
  const linkPath = `/problem/${pid}/solution/${solution.docId}`;

  return (
    <div
      id={`solution-${solution.docId}`}
      className={cn(
        'scroll-mt-24 space-y-3',
        highlighted &&
          'rounded-xl ring-2 ring-primary/40 ring-offset-4 ring-offset-background'
      )}
      data-llm-visible="true"
    >
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <SolutionVote
            pid={pid}
            sid={solution.docId}
            initialVote={vote}
            initialUserVote={userVote}
          />
          {user && <UserSpan user={user} showAvatar />}
          <SolutionStatus
            status={solution.reviewStatus}
            fallbackLabel={reviewLabel}
          />
        </div>
        <div className="flex items-center gap-x-1">
          <span className="flex items-center text-sm">{createdAt}</span>
          <SolutionCopyLink path={linkPath} />
          {canEdit && (
            <Button
              asChild
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={t('edit')}
              title={t('edit')}
            >
              <EntityHoverLink
                href={`/problem/${pid}/solution/${solution.docId}/edit`}
                prefetch={false}
              >
                <Pencil strokeWidth={2} />
                <span className="sr-only" data-llm-text={t('edit')}>
                  {t('edit')}
                </span>
              </EntityHoverLink>
            </Button>
          )}
          {canDelete && (
            <SolutionDeleteButton pid={pid} psid={solution.docId} />
          )}
        </div>
      </div>

      <Markdown>{solution.content}</Markdown>

      <SolutionReplies
        pid={pid}
        psid={solution.docId}
        replies={solution.reply ?? []}
        udict={udict}
        viewerId={viewerId}
        permissions={permissions}
        canReply={canReply}
      />
    </div>
  );
}
