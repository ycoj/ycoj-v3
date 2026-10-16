'use client';

import ClientApis from '@/api/client/method';
import {
  ANALYSIS_TOOL_KEYS,
  getAnalysisEventKey,
  getAnalysisStageKey,
} from '@/features/contest/analysis/contest-analysis-helpers';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Progress } from '@/shared/components/ui/progress';
import { cn } from '@/shared/lib/utils';
import type { ContestAnalysisJob } from '@/shared/types/contest-analysis';
import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  Square,
  Wrench,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Props = {
  job: ContestAnalysisJob;
  canManage: boolean;
};

export default function ContestAnalysisProgress({ job, canManage }: Props) {
  const t = useTranslations('contest.analysis');
  const format = useFormatter();
  const router = useRouter();
  const [current, setCurrent] = useState(job);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    let canceled = false;
    const timer = window.setInterval(async () => {
      try {
        const response = await ClientApis.Contest.getContestAnalysisJob(
          current.jobId
        ).send();
        if (canceled || 'error' in response) return;
        setCurrent(response.job);
        if (
          response.job.status !== 'pending' &&
          response.job.status !== 'running'
        )
          router.refresh();
      } catch {
        // Transient polling failures keep the previous snapshot on screen.
      }
    }, 3000);
    return () => {
      canceled = true;
      window.clearInterval(timer);
    };
  }, [current.jobId, router]);

  const events = [...current.events].reverse();
  const eventLabel = (event: (typeof events)[number]) => {
    const key = event.tool
      ? ANALYSIS_TOOL_KEYS[event.tool]
      : getAnalysisEventKey(event.code);
    return key
      ? t(key, event.params as Record<string, string | number>)
      : event.label;
  };
  const cancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await ClientApis.Contest.cancelContestAnalysis(current.jobId).send();
      router.refresh();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="space-y-4" data-llm-visible="true">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-teal-600"
            />
            <span data-llm-text={t(getAnalysisStageKey(current.stage))}>
              {t(getAnalysisStageKey(current.stage))}
            </span>
          </CardTitle>
          <CardDescription data-llm-text={current.scope?.title ?? ''}>
            {current.scope?.title}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={current.progress} />
          <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="tabular-nums">{current.progress}%</span>
            <span>
              {t('progressMeta', {
                contests: current.scope?.contests.length ?? 0,
                students: current.scope?.studentCount ?? 0,
                model: current.model ?? '-',
              })}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">{t('runningHint')}</p>
          {canManage && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={cancelling}
                onClick={() => void cancel()}
              >
                {cancelling ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Square aria-hidden="true" />
                )}
                {cancelling ? t('cancelling') : t('cancel')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('timeline')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {events.map((event) => (
              <li key={event.seq} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5">
                  {event.state === 'running' ? (
                    <LoaderCircle
                      aria-hidden="true"
                      className="text-muted-foreground size-4 animate-spin"
                    />
                  ) : event.state === 'failed' ? (
                    <CircleAlert
                      aria-hidden="true"
                      className="text-destructive size-4"
                    />
                  ) : (
                    <CircleCheck
                      aria-hidden="true"
                      className="size-4 text-teal-600"
                    />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block',
                      event.state === 'failed' && 'text-destructive'
                    )}
                  >
                    {event.tool && (
                      <Wrench
                        aria-hidden="true"
                        className="mr-1 inline size-3 align-[-1px]"
                      />
                    )}
                    {eventLabel(event)}
                  </span>
                  {event.detail && (
                    <span className="text-muted-foreground block break-words text-xs">
                      {event.detail}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {format.dateTime(new Date(event.startedAt), {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
