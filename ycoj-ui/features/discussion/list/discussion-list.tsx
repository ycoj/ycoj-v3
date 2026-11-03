import type { DiscussionMainResponse } from '@/api/server/method/discussion/main';
import DiscussionTime from '@/features/discussion/discussion-time';
import UserAvatar from '@/features/user/user-avatar';
import UserSpan from '@/features/user/user-span';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { cn } from '@/shared/lib/utils';
import type { Discussion } from '@/shared/types/discussion';
import { Eye, MessageCircle, Pin, Search, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  data: DiscussionMainResponse;
};

function getNodeTitle(
  discussion: Discussion,
  vndict: DiscussionMainResponse['vndict'],
  fallback: string
): string {
  const vnode = vndict[discussion.parentType]?.[discussion.parentId];
  if (!vnode) return fallback;
  return (vnode as { title?: string }).title || fallback;
}

function DiscussionItem({
  discussion,
  udict,
  vndict,
}: {
  discussion: Discussion;
  udict: DiscussionMainResponse['udict'];
  vndict: DiscussionMainResponse['vndict'];
}) {
  const t = useTranslations('discussion');
  const owner = udict[discussion.owner];
  const nodeTitle = getNodeTitle(discussion, vndict, t('unknownNode'));

  return (
    <li
      data-llm-visible="true"
      className={cn(
        'hover:bg-accent/40 flex items-center gap-3 px-4 py-3.5 transition-colors sm:gap-4 sm:px-5',
        discussion.pin && 'bg-amber-50/70 dark:bg-amber-500/5'
      )}
    >
      {owner && (
        <UserAvatar user={owner} className="size-10 shrink-0 self-start" />
      )}

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {discussion.pin && (
            <Pin
              className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-label={t('pinned')}
            />
          )}
          {discussion.highlight && (
            <Star
              className="size-4 shrink-0 text-blue-600 dark:text-blue-400"
              aria-label={t('featured')}
            />
          )}
          <Link
            href={`/discussion/${discussion.docId}`}
            prefetch={false}
            data-llm-text={discussion.title}
            className="text-foreground hover:text-primary min-w-0 truncate text-sm font-medium md:text-base"
          >
            {discussion.title}
          </Link>
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {owner && (
            <>
              <UserSpan user={owner} showAvatar={false} />
              <span aria-hidden="true">·</span>
            </>
          )}
          <span
            className="bg-secondary text-secondary-foreground max-w-40 truncate rounded px-1.5 py-0.5"
            title={t('node')}
            data-llm-text={nodeTitle}
          >
            {nodeTitle}
          </span>
          <span aria-hidden="true">·</span>
          <DiscussionTime value={discussion.updateAt} />
          <span
            className="inline-flex items-center gap-1 tabular-nums sm:hidden"
            title={t('replyCount')}
          >
            <MessageCircle className="size-3.5" />
            {discussion.nReply}
          </span>
        </div>
      </div>

      <dl className="text-muted-foreground hidden shrink-0 items-center gap-5 text-xs sm:flex">
        <div className="flex w-12 flex-col items-center gap-0.5">
          <dt className="sr-only">{t('replyCount')}</dt>
          <dd
            className={cn(
              'text-foreground inline-flex items-center gap-1 text-base font-medium tabular-nums',
              discussion.nReply === 0 && 'text-muted-foreground font-normal'
            )}
            data-llm-text={String(discussion.nReply)}
          >
            <MessageCircle className="size-4" />
            {discussion.nReply}
          </dd>
        </div>
        <div className="flex w-14 flex-col items-center gap-0.5">
          <dt className="sr-only">{t('views')}</dt>
          <dd
            className="inline-flex items-center gap-1 tabular-nums"
            data-llm-text={String(discussion.views)}
          >
            <Eye className="size-3.5" />
            {discussion.views}
          </dd>
        </div>
      </dl>
    </li>
  );
}

export default function DiscussionList({ data }: Props) {
  const t = useTranslations('discussion');
  if (!data.ddocs.length) {
    return (
      <Empty className="border border-dashed" data-llm-visible="true">
        <EmptyMedia variant="icon">
          <Search strokeWidth={2} />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle data-llm-text={t('none')}>{t('none')}</EmptyTitle>
          <EmptyDescription data-llm-text={t('noneDescription')}>
            {t('noneDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ul
      className="bg-card divide-y overflow-hidden rounded-xl border"
      data-llm-visible="true"
    >
      {data.ddocs.map((discussion) => (
        <DiscussionItem
          key={discussion.docId}
          discussion={discussion}
          udict={data.udict}
          vndict={data.vndict}
        />
      ))}
    </ul>
  );
}
