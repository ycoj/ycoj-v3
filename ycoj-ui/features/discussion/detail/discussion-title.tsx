import DiscussionTime from '@/features/discussion/discussion-time';
import UserAvatar from '@/features/user/user-avatar';
import UserSpan from '@/features/user/user-span';
import { Badge } from '@/shared/components/ui/badge';
import type {
  DiscussionDetailVnode,
  DiscussionDoc,
} from '@/shared/types/discussion';
import type { BaseUser } from '@/shared/types/user';
import { ArrowLeft, Eye, MessageCircle, Pin, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  ddoc: DiscussionDoc;
  owner?: BaseUser;
  vnode: DiscussionDetailVnode;
  drcount: number;
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
}: Props) {
  const t = useTranslations('discussion');
  const vnodeTitle = getVnodeTitle(vnode);
  const replyCount = Number.isFinite(drcount) ? drcount : ddoc.nReply;

  return (
    <header data-llm-visible="true" className="space-y-4 border-b pb-5">
      <Link
        href="/discussion"
        prefetch={false}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft className="size-3.5" />
        <span data-llm-text={t('backToList')}>{t('backToList')}</span>
      </Link>

      <div className="space-y-2">
        {(ddoc.pin || ddoc.highlight || vnodeTitle) && (
          <div className="flex flex-wrap items-center gap-2">
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
        )}
        <h1
          className="text-2xl leading-snug font-semibold break-words"
          data-llm-text={ddoc.title}
        >
          {ddoc.title}
        </h1>
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {owner && (
          <span className="inline-flex items-center gap-2">
            <UserAvatar user={owner} className="size-8 shrink-0" />
            <span className="text-sm" data-llm-text={owner.uname}>
              <UserSpan user={owner} showAvatar={false} />
            </span>
          </span>
        )}
        <DiscussionTime value={ddoc.updateAt} />
        <span
          className="inline-flex items-center gap-1 tabular-nums"
          title={t('replyCount')}
        >
          <MessageCircle className="size-3.5" />
          <span data-llm-text={String(replyCount)}>{replyCount}</span>
        </span>
        <span
          className="inline-flex items-center gap-1 tabular-nums"
          title={t('views')}
        >
          <Eye className="size-3.5" />
          <span data-llm-text={String(ddoc.views)}>{ddoc.views}</span>
        </span>
      </div>
    </header>
  );
}
