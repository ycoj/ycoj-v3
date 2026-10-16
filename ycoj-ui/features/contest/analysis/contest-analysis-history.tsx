import {
  getAnalysisStageKey,
  isActiveAnalysisStatus,
} from '@/features/contest/analysis/contest-analysis-helpers';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { ContestAnalysisOverview } from '@/shared/types/contest-analysis';
import {
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  Sparkles,
} from 'lucide-react';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';

export default async function ContestAnalysisHistory({
  overview,
}: {
  overview: ContestAnalysisOverview;
}) {
  const t = await getTranslations('contest.analysis');
  const format = await getFormatter();

  return (
    <div className="space-y-4" data-llm-visible="true">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-xl font-semibold"
            data-llm-text={t('historyTitle')}
          >
            {t('historyTitle')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t('historyDescription')}
          </p>
        </div>
        <Button asChild>
          <Link href="/contest">
            <Sparkles aria-hidden="true" />
            {t('newAnalysis')}
          </Link>
        </Button>
      </header>

      {!overview.enabled && (
        <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-sm">
          {t('unavailable')}
        </p>
      )}

      {overview.jobs.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
          {t('historyEmpty')}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {overview.jobs.map((job) => {
            const active = isActiveAnalysisStatus(job.status);
            return (
              <li key={job.jobId}>
                <Link
                  href={`/contest/analysis/${job.jobId}`}
                  className="bg-card hover:border-teal-400 flex h-full flex-col gap-2 rounded-xl border p-4 shadow-xs transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium" data-llm-text={job.title}>
                      {job.title}
                    </span>
                    <span className="shrink-0">
                      {active ? (
                        <Badge variant="secondary" className="gap-1">
                          <LoaderCircle
                            aria-hidden="true"
                            className="size-3 animate-spin"
                          />
                          {t(getAnalysisStageKey(job.stage))}
                        </Badge>
                      ) : job.status === 'completed' ? (
                        <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                          <CheckCircle2 aria-hidden="true" className="size-3" />
                          {t('status.completed')}
                        </Badge>
                      ) : (
                        <Badge className="gap-1 bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300">
                          <CircleAlert aria-hidden="true" className="size-3" />
                          {t(
                            `status.${job.status === 'cancelled' ? 'cancelled' : 'failed'}`
                          )}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {t('historyMeta', {
                      contests: job.contestCount,
                      students: job.studentCount,
                      time: format.dateTime(new Date(job.createdAt), {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    })}
                  </p>
                  {active && (
                    <span className="bg-muted block h-1.5 overflow-hidden rounded-full">
                      <span
                        className={cn('block h-full rounded-full bg-teal-500')}
                        style={{ width: `${job.progress}%` }}
                      />
                    </span>
                  )}
                  {job.error && (
                    <p className="text-destructive text-xs">{job.error}</p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
