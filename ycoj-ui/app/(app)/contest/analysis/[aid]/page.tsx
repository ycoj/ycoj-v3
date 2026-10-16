import ServerApis from '@/api/server/method';
import ContestAnalysisFailure from '@/features/contest/analysis/contest-analysis-failure';
import ContestAnalysisProgress from '@/features/contest/analysis/contest-analysis-progress';
import ContestAnalysisReport from '@/features/contest/analysis/contest-analysis-report';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = { aid: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('contest.analysis');
  return { title: t('pageTitle') };
}

export default async function ContestAnalysisPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { aid } = await params;
  const [data, t] = await Promise.all([
    ServerApis.Contests.getContestAnalysisJob(aid),
    getTranslations('error'),
  ]);
  if ('error' in data)
    return <Errored title={t('unavailable')} error={String(data.error)} />;
  const { job, canManage } = data;
  if (job.status === 'pending' || job.status === 'running')
    return <ContestAnalysisProgress job={job} canManage={canManage} />;
  if (job.status === 'failed' || job.status === 'cancelled')
    return <ContestAnalysisFailure job={job} canManage={canManage} />;
  return <ContestAnalysisReport job={job} canManage={canManage} />;
}
