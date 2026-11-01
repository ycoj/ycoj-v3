import ServerApis from '@/api/server/method';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import DiscussionList from '@/features/discussion/list/discussion-list';
import DiscussionNodeFilter from '@/features/discussion/list/discussion-node-filter';
import { getUser } from '@/features/user/lib/get-user';
import Pagination from '@/shared/components/pagination';
import { Button } from '@/shared/components/ui/button';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

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

  return (
    <div className="space-y-4">
      <DiscussionNodeFilter
        vnodes={data.vnodes}
        canCreate={permissions.canCreate}
      />
      {permissions.canCreate && !nodeId && (
        <div className="flex justify-end">
          <Button asChild className="gap-2">
            <Link href="/discussion/create" prefetch={false}>
              <Plus strokeWidth={2} />
              <span data-llm-text={t('create')}>{t('create')}</span>
            </Link>
          </Button>
        </div>
      )}
      <DiscussionList data={data} />
      <div className="pt-1">
        <Pagination page={data.page} totalPages={data.dpcount} />
      </div>
    </div>
  );
}
