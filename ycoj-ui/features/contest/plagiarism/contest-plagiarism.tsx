'use client';

import ClientApis from '@/api/client/method';
import { localizePlagiarismExplanation } from '@/features/contest/plagiarism/plagiarism-messages';
import PlagiarismReportView from '@/features/contest/plagiarism/plagiarism-report';
import { Button } from '@/shared/components/ui/button';
import { throwBackendError } from '@/shared/lib/backend-response';
import type { Contest } from '@/shared/types/contest';
import type { PlagiarismJob } from '@/shared/types/contest-plagiarism';
import { LoaderCircle, ScanSearch } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

type Props = { tid: string; contest: Contest };

export default function ContestPlagiarism({ tid, contest }: Props) {
  const t = useTranslations('contestManagement.plagiarism');
  const format = useFormatter();
  const [ended, setEnded] = useState(
    () => new Date(contest.endAt).getTime() <= Date.now()
  );
  const [job, setJob] = useState<PlagiarismJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const active = job?.status === 'pending' || job?.status === 'running';

  useEffect(() => {
    if (ended) return;
    const timer = window.setInterval(() => {
      if (new Date(contest.endAt).getTime() <= Date.now()) setEnded(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [contest.endAt, ended]);

  useEffect(() => {
    if (!ended) return;
    let canceled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response =
          await ClientApis.Contest.getContestPlagiarism(tid).send();
        throwBackendError(response);
        if (!('error' in response) && !canceled) setJob(response.job);
      } catch (cause) {
        if (!canceled)
          setError(
            cause instanceof Error
              ? localizePlagiarismExplanation(cause.message, t)
              : t('loadFailed')
          );
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [ended, retry, t, tid]);

  useEffect(() => {
    if (!job || !active || error) return;
    let canceled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await ClientApis.Contest.getContestPlagiarismJob(
          tid,
          job.jobId
        ).send();
        throwBackendError(response);
        if (!('error' in response) && !canceled) setJob(response);
      } catch (cause) {
        if (!canceled)
          setError(
            cause instanceof Error
              ? localizePlagiarismExplanation(cause.message, t)
              : t('pollFailed')
          );
      }
    }, 1000);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [active, error, job, t, tid]);

  async function start() {
    if (!ended || starting || active || loading) return;
    setStarting(true);
    setError('');
    try {
      const response =
        await ClientApis.Contest.startContestPlagiarism(tid).send();
      throwBackendError(response);
      if (!('error' in response)) setJob(response);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? localizePlagiarismExplanation(cause.message, t)
          : t('startFailed')
      );
    } finally {
      setStarting(false);
    }
  }

  const statusText = active
    ? job?.status === 'pending'
      ? t('queued')
      : t('running')
    : job?.status === 'completed'
      ? t('completed')
      : job?.status === 'failed'
        ? t('failed')
        : '';

  return (
    <div className="min-w-0 space-y-8" data-llm-visible="true">
      <section className="space-y-4">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold" data-llm-text={t('title')}>
            {t('title')}
          </h1>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t('description')}
          </p>
        </header>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={!ended || loading || starting || active}
            onClick={() => void start()}
          >
            {starting || active ? (
              <LoaderCircle className="motion-safe:animate-spin" />
            ) : (
              <ScanSearch />
            )}
            {starting ? t('starting') : job ? t('runAgain') : t('run')}
          </Button>
          {ended && loading && <p role="status">{t('loading')}</p>}
          {!ended && (
            <p className="text-sm text-muted-foreground">
              {t('afterEnd', {
                end: format.dateTime(new Date(contest.endAt), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </p>
          )}
        </div>
        {error && (
          <div className="flex flex-wrap items-center gap-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
              disabled={loading || starting}
            >
              {t('retry')}
            </Button>
          </div>
        )}
        {job && (
          <div className="space-y-2 border-y py-4" aria-live="polite">
            <p className="text-sm font-medium" role="status">
              {statusText}
              {job.progress && active && (
                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                  {t('progress', {
                    completed: job.progress.completedPairs,
                    total: job.progress.totalPairs,
                  })}
                </span>
              )}
            </p>
            {active && (
              <p className="text-sm text-muted-foreground">{t('background')}</p>
            )}
            {job.status === 'failed' && (
              <p role="alert" className="text-sm text-destructive">
                {job.error
                  ? localizePlagiarismExplanation(job.error, t)
                  : t('taskFailed')}
              </p>
            )}
          </div>
        )}
        {!loading && ended && !job && !error && (
          <p className="text-sm text-muted-foreground">{t('notRun')}</p>
        )}
      </section>
      {job?.status === 'completed' && job.result && (
        <PlagiarismReportView
          key={job.jobId}
          tid={tid}
          jobId={job.jobId}
          report={job.result}
        />
      )}
    </div>
  );
}
