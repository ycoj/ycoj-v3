import ContestAnalysisActions from '@/features/contest/analysis/contest-analysis-actions';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import type { ContestAnalysisJob } from '@/shared/types/contest-analysis';
import { TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export default async function ContestAnalysisFailure({
  job,
  canManage,
}: {
  job: ContestAnalysisJob;
  canManage: boolean;
}) {
  const t = await getTranslations('contest.analysis');
  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TriangleAlert
            aria-hidden="true"
            className="text-destructive size-4"
          />
          <span data-llm-text={t('failureTitle')}>{t('failureTitle')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">{job.scope?.title}</p>
        <p className="text-destructive text-sm" data-llm-text={job.error ?? ''}>
          {job.error ?? t('failureFallback')}
        </p>
        <ContestAnalysisActions
          jobId={job.jobId}
          status={job.status}
          canManage={canManage}
        />
      </CardContent>
    </Card>
  );
}
