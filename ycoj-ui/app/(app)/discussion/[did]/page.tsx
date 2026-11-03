import DiscussionActions from '@/features/discussion/detail/discussion-actions';
import DiscussionContent from '@/features/discussion/detail/discussion-content';
import DiscussionHistoryPopover from '@/features/discussion/detail/discussion-history-popover';
import DiscussionReactions from '@/features/discussion/detail/discussion-reactions';
import DiscussionReplies from '@/features/discussion/detail/discussion-replies';
import DiscussionTitle from '@/features/discussion/detail/discussion-title';
import { getDiscussionDetail } from '@/features/discussion/detail/get-discussion-detail';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import { getUser } from '@/features/user/lib/get-user';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

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
  // `GET /discuss/:did` signs in the viewer to return their status; a signed-in
  // viewer may always star. The backend endpoint itself has no extra permission.
  const canStar = !!user?._id;

  return (
    <div className="space-y-8">
      <article className="bg-card rounded-xl border">
        <div className="space-y-5 p-5 sm:p-6">
          <DiscussionTitle
            ddoc={data.ddoc}
            owner={owner}
            vnode={data.vnode}
            drcount={data.drcount}
          />
          <DiscussionContent content={data.ddoc.content} />
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t px-5 py-3 sm:px-6">
          <DiscussionReactions
            did={did}
            nodeType="did"
            id={did}
            reactions={data.ddoc.react ?? {}}
            ownReactions={data.reactions[did] ?? {}}
            canReact={permissions.canReact}
          />
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {data.ddoc.edited && <DiscussionHistoryPopover did={did} />}
            <DiscussionActions
              ddoc={data.ddoc}
              viewerId={user?._id}
              permissions={permissions}
              starred={!!data.dsdoc?.star}
              canStar={canStar}
            />
          </div>
        </footer>
      </article>
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
