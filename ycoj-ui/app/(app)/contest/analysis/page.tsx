import ServerApis from '@/api/server/method';
import ContestAnalysisHistory from '@/features/contest/analysis/contest-analysis-history';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contest.analysis');
  return { title: t('historyTitle') };
}

export default async function ContestAnalysisListPage() {
  const [data, t] = await Promise.all([
    ServerApis.Contests.getContestAnalysisOverview(),
    getTranslations('error'),
  ]);
  if ('error' in data)
    return <Errored title={t('unavailable')} error={String(data.error)} />;
  return <ContestAnalysisHistory overview={data} />;
}
