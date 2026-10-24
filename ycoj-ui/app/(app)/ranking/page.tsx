import ServerApis from '@/api/server/method';
import RankingLeaderboard from '@/features/ranking/ranking-leaderboard';
import RankingSortControl from '@/features/ranking/ranking-sort-control';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import Pagination from '@/shared/components/pagination';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('ranking') };
}

export type SearchParams = {
  page?: string;
  sort?: string;
};

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export default async function RankingPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [searchParams, user] = await Promise.all([
    searchParamsPromise,
    getUser(),
  ]);
  const page = parsePage(searchParams.page);
  const canViewRating = hasPerm(user, PERM.PERM_VIEW_CONTEST_SCOREBOARD);
  const sort =
    searchParams.sort === 'rating' && canViewRating ? 'rating' : 'rp';

  const data = await ServerApis.Ranking.getRankingList(page, sort);
  /** Page size derived from total users and total pages (for rank index) */
  const pageSize = data.pageSize;

  return (
    <div className="space-y-4" data-llm-visible="true">
      <RankingSortControl sort={sort} canViewRating={canViewRating} />
      <RankingLeaderboard
        udocs={data.udocs}
        page={data.page}
        pageSize={pageSize}
        sort={sort}
      />
      <div className="pt-1">
        <Pagination page={data.page} totalPages={data.upcount} />
      </div>
    </div>
  );
}
