import DiscussionTime from '@/features/discussion/discussion-time';
import UserAvatar from '@/features/user/user-avatar';
import UserSpan from '@/features/user/user-span';
import { Badge } from '@/shared/components/ui/badge';
import type {
  DiscussionDetailVnode,
  DiscussionDoc,
} from '@/shared/types/discussion';
import type { BaseUser } from '@/shared/types/user';
import { Pin, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

type Props = {
  ddoc: DiscussionDoc;
  owner?: BaseUser;
  vnode: DiscussionDetailVnode;
  drcount: number;
  /** Edit history control, shown beside the timestamp when the topic was edited. */
  history?: ReactNode;
  /** Topic actions (follow, edit, lock, delete), aligned with the counts. */
  actions?: ReactNode;
};

function getVnodeTitle(vnode: DiscussionDetailVnode): string | null {
  if (!vnode || typeof vnode !== 'object' || Array.isArray(vnode)) return null;
  const title = 'title' in vnode ? vnode.title : undefined;
  if (typeof title !== 'string') return null;

  const normalized = title.trim();
  return normalized.length ? normalized : null;
}

export default function DiscussionTitle({
  ddoc,
  owner,
  vnode,
  drcount,
  history,
  actions,
}: Props) {
  const t = useTranslations('discussion');
  const vnodeTitle = getVnodeTitle(vnode);
  const replyCount = Number.isFinite(drcount) ? drcount : ddoc.nReply;

  return (
    <header
      data-llm-visible="true"
      className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4 border-b pb-5"
    >
      <div className="min-w-[min(100%,20rem)] flex-1 space-y-3">
        <h1
          className="text-3xl leading-snug font-semibold break-words"
          data-llm-text={ddoc.title}
        >
          {ddoc.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          {owner && (
            <span className="inline-flex items-center gap-2">
              <UserAvatar user={owner} className="size-8 shrink-0" />
              <span data-llm-text={owner.uname}>
                <UserSpan user={owner} showAvatar={false} />
              </span>
            </span>
          )}
          {owner && (
            <span aria-hidden="true" className="text-muted-foreground">
              ·
            </span>
          )}
          <DiscussionTime
            value={ddoc.updateAt}
            className="text-muted-foreground"
          />
          {history}
          {ddoc.pin && (
            <Badge
              variant="secondary"
              className="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400"
            >
              <Pin data-icon="inline-start" />
              {t('pinned')}
            </Badge>
          )}
          {ddoc.highlight && (
            <Badge
              variant="secondary"
              className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400"
            >
              <Star data-icon="inline-start" />
              {t('featured')}
            </Badge>
          )}
          {vnodeTitle && (
            <Badge variant="outline" title={t('node')}>
              <span data-llm-text={vnodeTitle}>{vnodeTitle}</span>
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1.5">
        <dl className="flex items-center gap-4 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t('replyCount')}</dt>
            <dd
              className="text-foreground font-medium tabular-nums"
              data-llm-text={String(replyCount)}
            >
              {replyCount}
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted-foreground">{t('views')}</dt>
            <dd
              className="text-foreground font-medium tabular-nums"
              data-llm-text={String(ddoc.views)}
            >
              {ddoc.views}
            </dd>
          </div>
        </dl>
        {actions}
      </div>
    </header>
  );
}
