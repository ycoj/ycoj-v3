import DiscussionActions from '@/features/discussion/detail/discussion-actions';
import DiscussionContent from '@/features/discussion/detail/discussion-content';
import DiscussionHistoryPopover from '@/features/discussion/detail/discussion-history-popover';
import DiscussionReactions from '@/features/discussion/detail/discussion-reactions';
import DiscussionReplies from '@/features/discussion/detail/discussion-replies';
import DiscussionTitle from '@/features/discussion/detail/discussion-title';
import { getDiscussionDetail } from '@/features/discussion/detail/get-discussion-detail';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import { getUser } from '@/features/user/lib/get-user';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type Params = {
  did: string;
};

type SearchParams = {
  page?: string;
};

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { did } = await params;
  const data = await getDiscussionDetail(did);
  const t = await getTranslations('metadata');

  return {
    title: data.ddoc.title || t('discussionDetail'),
  };
}

export default async function DiscussionPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { did } = await params;
  const searchParams = await searchParamsPromise;
  const page = parsePage(searchParams.page);
  const [data, user] = await Promise.all([
    getDiscussionDetail(did, page),
    getUser(),
  ]);
  const owner = data.udict[data.ddoc.owner];
  const permissions = resolveDiscussionPermissions(user);
  const t = await getTranslations('discussion');
  // `GET /discuss/:did` signs in the viewer to return their status; a signed-in
  // viewer may always star. The backend endpoint itself has no extra permission.
  const canStar = !!user?._id;
  const showReactions =
    permissions.canReact ||
    Object.values(data.ddoc.react ?? {}).some((count) => count > 0);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/discussion"
          prefetch={false}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-sm py-1 text-sm"
        >
          <ArrowLeft className="size-3.5" />
          <span data-llm-text={t('backToList')}>{t('backToList')}</span>
        </Link>
        <article className="bg-card rounded-xl border">
          <div className="space-y-6 p-5 sm:p-6">
            <DiscussionTitle
              ddoc={data.ddoc}
              owner={owner}
              vnode={data.vnode}
              drcount={data.drcount}
              history={
                data.ddoc.edited ? (
                  <DiscussionHistoryPopover did={did} />
                ) : undefined
              }
              actions={
                <DiscussionActions
                  ddoc={data.ddoc}
                  viewerId={user?._id}
                  permissions={permissions}
                  starred={!!data.dsdoc?.star}
                  canStar={canStar}
                />
              }
            />
            <DiscussionContent content={data.ddoc.content} />
          </div>
          {showReactions && (
            <footer className="border-t px-5 py-3 sm:px-6">
              <DiscussionReactions
                did={did}
                nodeType="did"
                id={did}
                reactions={data.ddoc.react ?? {}}
                ownReactions={data.reactions[did] ?? {}}
                canReact={permissions.canReact}
              />
            </footer>
          )}
        </article>
      </div>
      <DiscussionReplies
        did={did}
        ddoc={data.ddoc}
        drdocs={data.drdocs}
        udict={data.udict}
        page={data.page}
        pcount={data.pcount}
        replyCount={data.drcount}
        reactions={data.reactions}
      />
    </div>
  );
}
