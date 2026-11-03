import ServerApis from '@/api/server/method';
import { getDiscussionNodeContext } from '@/features/discussion/lib/get-discussion-node';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import DiscussionList from '@/features/discussion/list/discussion-list';
import DiscussionListHeader from '@/features/discussion/list/discussion-list-header';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import Pagination from '@/shared/components/pagination';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Params = {
  did: string;
  name: string;
};

type SearchParams = {
  page?: string;
};

const NODE_TYPES = new Set(['problem', 'contest', 'training', 'homework']);

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { did: type, name } = await params;
  const t = await getTranslations('metadata');
  if (!NODE_TYPES.has(type)) return { title: t('discussionList') };
  const node = await getDiscussionNodeContext(type, name);
  return {
    title: node
      ? `${node.title} - ${t('discussionList')}`
      : t('discussionList'),
  };
}

/**
 * Resource-scoped discussion list, matching the legacy `/discuss/:type/:name`
 * for problems, contests, training and homework. The plain `/discussion?node=`
 * filter remains for standalone discussion nodes.
 */
export default async function DiscussionNodePage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ did: type, name }, searchParams] = await Promise.all([
    params,
    searchParamsPromise,
  ]);
  if (!NODE_TYPES.has(type)) notFound();

  const page = parsePage(searchParams.page);
  const [node, data, user] = await Promise.all([
    getDiscussionNodeContext(type, name),
    ServerApis.Discussion.getDiscussionInNode(type, name, page),
    getUser(),
  ]);
  const t = await getTranslations('discussion');
  const permissions = resolveDiscussionPermissions(user);

  if (!node || 'error' in data) {
    return (
      <Errored title={t('unknownNode')} error={t('unknownNodeDescription')} />
    );
  }

  const createHref = `/discussion/${type}/${encodeURIComponent(name)}/create`;

  return (
    <div className="space-y-5">
      <DiscussionListHeader
        title={node.title}
        backHref="/discussion"
        createHref={permissions.canCreate ? createHref : undefined}
      />
      <DiscussionList data={data} />
      <div className="pt-1">
        <Pagination page={data.page} totalPages={data.dpcount} />
      </div>
    </div>
  );
}
