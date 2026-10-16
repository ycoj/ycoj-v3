'use client';

import { formatScore } from '@/features/contest/analysis/contest-analysis-helpers';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { cn } from '@/shared/lib/utils';
import type {
  ContestAnalysisContestFact,
  ContestAnalysisStudentFact,
  ContestAnalysisStudentReport,
} from '@/shared/types/contest-analysis';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

type Props = {
  reports: ContestAnalysisStudentReport[];
  facts: ContestAnalysisStudentFact[];
  contests: ContestAnalysisContestFact[];
};

const LEVEL_VARIANT: Record<
  ContestAnalysisStudentReport['level'],
  { key: string; className: string }
> = {
  excellent: {
    key: 'levels.excellent',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
  },
  good: {
    key: 'levels.good',
    className:
      'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300',
  },
  average: {
    key: 'levels.average',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
  },
  weak: {
    key: 'levels.weak',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  at_risk: {
    key: 'levels.atRisk',
    className: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  },
};

export default function ContestAnalysisStudents({
  reports,
  facts,
  contests,
}: Props) {
  const t = useTranslations('contest.analysis');
  const [query, setQuery] = useState('');
  const [level, setLevel] = useState<
    'all' | ContestAnalysisStudentReport['level']
  >('all');

  const factByUid = useMemo(
    () => new Map(facts.map((fact) => [fact.uid, fact])),
    [facts]
  );
  const contestTitle = useMemo(
    () => new Map(contests.map((contest) => [contest.tid, contest.title])),
    [contests]
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visible = reports.filter((report) => {
    if (level !== 'all' && report.level !== level) return false;
    if (!normalizedQuery) return true;
    const fact = factByUid.get(report.uid);
    return [
      fact?.displayName,
      fact?.uname,
      fact?.realName,
      String(report.uid),
      ...report.focusTags,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedQuery));
  });

  const levels: Array<'all' | ContestAnalysisStudentReport['level']> = [
    'all',
    'excellent',
    'good',
    'average',
    'weak',
    'at_risk',
  ];

  return (
    <section
      id="students"
      aria-labelledby="students-title"
      className="space-y-4 scroll-mt-24"
      data-llm-visible="true"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="students-title"
            className="text-xl font-semibold"
            data-llm-text={t('students.title')}
          >
            {t('students.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('students.description', { count: reports.length })}
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input
            value={query}
            className="pl-8"
            placeholder={t('students.searchPlaceholder')}
            aria-label={t('students.searchPlaceholder')}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {levels.map((item) => {
          const count =
            item === 'all'
              ? reports.length
              : reports.filter((report) => report.level === item).length;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={level === item}
              onClick={() => setLevel(item)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                level === item
                  ? 'border-teal-500 bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-200'
                  : 'text-muted-foreground hover:bg-accent/40'
              )}
            >
              {item === 'all' ? t('students.all') : t(LEVEL_VARIANT[item].key)}
              <span className="ml-1 tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('students.empty')}</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((report) => {
            const fact = factByUid.get(report.uid);
            const levelMeta = LEVEL_VARIANT[report.level];
            return (
              <article
                key={report.uid}
                className="bg-card space-y-3 rounded-xl border p-4 shadow-xs break-inside-avoid"
                data-llm-visible="true"
              >
                <header className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3
                      className="truncate text-base font-semibold"
                      data-llm-text={fact?.displayName ?? String(report.uid)}
                    >
                      {fact?.displayName || fact?.uname || report.uid}
                    </h3>
                    <p className="text-muted-foreground truncate text-xs">
                      {[fact?.uname, fact?.realName]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <Badge
                    className={levelMeta.className}
                    data-llm-text={t(levelMeta.key)}
                  >
                    {t(levelMeta.key)}
                  </Badge>
                </header>

                {fact && (
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg border p-2">
                      <dt className="text-muted-foreground">
                        {t('students.solved')}
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">
                        {fact.totals.solvedCount}/{fact.totals.problemCount}
                      </dd>
                    </div>
                    <div className="rounded-lg border p-2">
                      <dt className="text-muted-foreground">
                        {t('students.average')}
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">
                        {formatScore(fact.totals.averageScore)}
                      </dd>
                    </div>
                    <div className="rounded-lg border p-2">
                      <dt className="text-muted-foreground">
                        {t('students.attended')}
                      </dt>
                      <dd className="text-sm font-semibold tabular-nums">
                        {fact.totals.attendedCount}/{fact.totals.contestCount}
                      </dd>
                    </div>
                  </dl>
                )}

                <p
                  className="text-sm whitespace-pre-line"
                  data-llm-text={report.summary}
                >
                  {report.summary}
                </p>

                {(report.strengths.length > 0 ||
                  report.weaknesses.length > 0) && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {report.strengths.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium">
                          {t('students.strengths')}
                        </h4>
                        <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs">
                          {report.strengths.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {report.weaknesses.length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium">
                          {t('students.weaknesses')}
                        </h4>
                        <ul className="text-muted-foreground mt-1 list-disc space-y-0.5 pl-4 text-xs">
                          {report.weaknesses.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {report.recurringIssues.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium">
                      {t('students.recurring')}
                    </h4>
                    <ul className="space-y-2">
                      {report.recurringIssues.map((issue, index) => (
                        <li
                          key={`${issue.issue}-${index}`}
                          className="rounded-lg border bg-muted/30 p-2 text-xs"
                        >
                          <p className="font-medium">{issue.issue}</p>
                          <p className="text-muted-foreground">
                            {issue.evidence}
                          </p>
                          <p className="text-teal-700 dark:text-teal-300">
                            {issue.advice}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {report.focusTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium">
                      {t('students.focusTags')}
                    </span>
                    {report.focusTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {report.contestComments.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer font-medium">
                      {t('students.perContest')}
                    </summary>
                    <ul className="text-muted-foreground mt-2 space-y-1">
                      {report.contestComments.map((comment) => (
                        <li key={comment.tid}>
                          <span className="font-medium">
                            {contestTitle.get(comment.tid) ?? comment.tid}
                          </span>
                          {' · '}
                          {comment.comment}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {report.actionPlan.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium">
                      {t('students.actionPlan')}
                    </h4>
                    <ol className="text-muted-foreground mt-1 list-decimal space-y-0.5 pl-4 text-xs">
                      {report.actionPlan.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
