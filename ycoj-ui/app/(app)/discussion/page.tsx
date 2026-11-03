import ServerApis from '@/api/server/method';
import { discussionCreatePath } from '@/features/discussion/lib/node';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import DiscussionList from '@/features/discussion/list/discussion-list';
import DiscussionListHeader from '@/features/discussion/list/discussion-list-header';
import DiscussionNodeFilter from '@/features/discussion/list/discussion-node-filter';
import { getUser } from '@/features/user/lib/get-user';
import Pagination from '@/shared/components/pagination';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('discussionList') };
}

export type SearchParams = {
  page?: string;
  node?: string;
};

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function normalizeParam(value?: string) {
  const normalized = value?.trim();
  return normalized && normalized !== 'all' ? normalized : undefined;
}

export default async function DiscussionPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const page = parsePage(searchParams.page);
  const nodeId = normalizeParam(searchParams.node);
  const [data, user] = await Promise.all([
    nodeId
      ? ServerApis.Discussion.getDiscussionInNode('node', nodeId, page)
      : ServerApis.Discussion.getDiscussionMain(page),
    getUser(),
  ]);
  const permissions = resolveDiscussionPermissions(user);
  const t = await getTranslations('discussion');

  const createHref = nodeId
    ? discussionCreatePath('node', nodeId)
    : '/discussion/create';

  return (
    <div className="space-y-5">
      <DiscussionListHeader
        title={t('title')}
        subtitle={t('subtitle')}
        createHref={permissions.canCreate ? createHref : undefined}
      />
      <DiscussionNodeFilter vnodes={data.vnodes} selectedNodeId={nodeId} />
      <DiscussionList data={data} />
      <div className="pt-1">
        <Pagination page={data.page} totalPages={data.dpcount} />
      </div>
    </div>
  );
}
