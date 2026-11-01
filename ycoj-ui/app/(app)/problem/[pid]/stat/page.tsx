import ServerApis from '@/api/server/method';
import { getProblemStatistics } from '@/api/server/method/problems/statistics';
import { getProblemDetail } from '@/features/problem/detail/get-problem-detail';
import ProblemTitle from '@/features/problem/detail/problem-title';
import { canEditProblem } from '@/features/problem/lib/can-edit-problem';
import ProblemSidebar from '@/features/problem/sidebar';
import ProblemStatisticsContent from '@/features/problem/statistics/problem-statistics-content';
import { resolveProblemStatSelection } from '@/features/problem/statistics/stat-selection';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import { Errored } from '@/shared/components/errored';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { ProblemStatQuery } from '@/shared/types/problem-statistics';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = { pid: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pid } = await params;
  const t = await getTranslations('metadata');
  const detail = await getProblemDetail(pid);
  if ('error' in detail || !detail.pdoc) return { title: t('problemStats') };
  return { title: `${detail.pdoc.title} - ${t('problemStats')}` };
}

export default async function ProblemStatisticsPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<Params>;
  searchParams: Promise<ProblemStatQuery>;
}) {
  const { pid } = await params;
  const searchParams = await searchParamsPromise;
  const selection = resolveProblemStatSelection(searchParams);

  // The title and sidebar need the same problem context as the statistics
  // payload; both requests are independent, so issue them together.
  const [data, detail, user] = await Promise.all([
    getProblemStatistics(pid, selection),
    getProblemDetail(pid),
    getUser(),
  ]);
  const t = await getTranslations('problem');

  if ('error' in data) {
    return <Errored title={t('unavailable')} error={data.error} />;
  }
  if ('error' in detail || !detail.pdoc) {
    return <Errored title={t('unavailable')} error={t('unavailable')} />;
  }

  // Restrict the language filter to the problem's allowed languages.
  const languages = await ServerApis.UI.getAvailableLanguages(
    detail.pdoc.docId
  );
  const canConfigure = canEditProblem(user, detail.pdoc);
  const canRejudge = hasPerm(user, PERM.PERM_REJUDGE_PROBLEM);

  return (
    <div className="space-y-6">
      <ProblemTitle problem={detail.pdoc} />
      <TwoColumnLayout
        ratio="8-2"
        left={
          <ProblemStatisticsContent
            data={data}
            selection={selection}
            languages={languages.languages}
          />
        }
        right={
          <ProblemSidebar
            allowSubmit={false}
            showBackToProblem={true}
            discussionCount={detail.discussionCount}
            solutionCount={detail.solutionCount}
            problem={detail.pdoc}
            allowConfigure={canConfigure}
            allowRejudge={canRejudge}
          />
        }
      />
    </div>
  );
}
