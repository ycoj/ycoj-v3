import ServerApis from '@/api/server/method';
import { getProblemDomainContext } from '@/api/server/method/problems/domain-context';
import { canEditSystem } from '@/features/manage/manage-access';
import {
  buildProblemQuery,
  parseProblemFilters,
  type ProblemFilterSearchParams,
} from '@/features/problem/list/problem-filter-utils';
import ProblemListBrowse from '@/features/problem/list/problem-list-browse';
import ProblemListHeader from '@/features/problem/list/problem-list-header';
import ProblemSearch from '@/features/problem/list/problem-search';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import Pagination from '@/shared/components/pagination';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('problemList') };
}

export type SearchParams = ProblemFilterSearchParams;

export default async function ProblemListPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const filters = parseProblemFilters(searchParams);
  const [data, user, tags, domain] = await Promise.all([
    ServerApis.Problems.getProblemsList(
      buildProblemQuery(filters) || undefined,
      filters.page,
      filters.sort
    ),
    getUser(),
    ServerApis.Problems.getProblemTags(),
    getProblemDomainContext(),
  ]);
  const domainId = domain?._id ?? data.pdocs[0]?.domainId ?? 'system';
  const namespaces = Object.keys(domain?.namespaces ?? {});

  return (
    <div className="space-y-5">
      <ProblemListBrowse
        header={
          <ProblemListHeader
            canCreate={hasPerm(user, PERM.PERM_CREATE_PROBLEM)}
            canReview={hasPerm(user, PERM.PERM_DELETE_PROBLEM_SOLUTION)}
            pendingSolutionCount={data.pendingSolutionCount}
            canManageFeedback={canEditSystem(user)}
          >
            <ProblemSearch filters={filters} />
          </ProblemListHeader>
        }
        filters={filters}
        categories={tags}
        namespaces={namespaces}
        data={data}
        showTags={filters.showTags}
        domainId={domainId}
        canManageAll={hasPerm(user, PERM.PERM_EDIT_PROBLEM)}
        canManageOwn={hasPerm(user, PERM.PERM_EDIT_PROBLEM_SELF)}
        userId={user?._id}
      />
      <Pagination page={data.page!} totalPages={data.ppcount!} />
    </div>
  );
}
