import ContestAnalysisActions from '@/features/contest/analysis/contest-analysis-actions';
import {
  formatScore,
  percentage,
} from '@/features/contest/analysis/contest-analysis-helpers';
import ContestAnalysisStudents from '@/features/contest/analysis/contest-analysis-students';
import Markdown from '@/shared/components/markdown';
import { Badge } from '@/shared/components/ui/badge';
import {
  PROBLEMS_DIFFICULTY_COLOR,
  PROBLEMS_DIFFICULTY_KEYS,
} from '@/shared/configs/difficulty';
import { cn } from '@/shared/lib/utils';
import type {
  ContestAnalysisContestFact,
  ContestAnalysisJob,
  ContestAnalysisSnapshot,
  ContestAnalysisWeakPoint,
} from '@/shared/types/contest-analysis';
import { getFormatter, getTranslations } from 'next-intl/server';
import Link from 'next/link';

type Props = {
  job: ContestAnalysisJob;
  canManage: boolean;
};

const SEVERITY_CLASS: Record<ContestAnalysisWeakPoint['severity'], string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-300',
};

function difficultyCellClass(difficulty: number) {
  const color =
    PROBLEMS_DIFFICULTY_COLOR[
      Math.min(Math.max(difficulty, 0), PROBLEMS_DIFFICULTY_COLOR.length - 1)
    ];
  return color;
}

function ScoreDistribution({
  context,
  buckets,
  bucketSize,
  label,
  rangeLabel,
  maxTotal,
}: {
  context: string;
  buckets: number[];
  bucketSize: number;
  label: string;
  rangeLabel: (from: number, to: number) => string;
  maxTotal: number;
}) {
  const max = Math.max(1, ...buckets);
  return (
    <div className="space-y-1.5" data-llm-visible="true">
      <p className="text-muted-foreground text-xs">{label}</p>
      {buckets.map((count, index) => {
        const from = index * bucketSize;
        const to = Math.min(maxTotal, from + bucketSize);
        return (
          <div
            key={from}
            className="grid grid-cols-[9rem_1fr_2.5rem] items-center gap-2 text-xs"
          >
            <span className="text-muted-foreground tabular-nums">
              {rangeLabel(from, to)}
            </span>
            <span
              aria-hidden="true"
              className="bg-muted h-2 overflow-hidden rounded-full"
            >
              <span
                className="block h-full rounded-full bg-teal-500/80"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </span>
            <span className="text-right tabular-nums">{count}</span>
          </div>
        );
      })}
      <span className="sr-only">{context}</span>
    </div>
  );
}

function ContestSection(props: {
  contest: ContestAnalysisContestFact;
  index: number;
  total: number;
  report?: {
    summary: string;
    difficultyComment: string;
    balanceComment: string;
    problemComments: { pid: number; comment: string }[];
  };
  range: string;
  formatDate: (value: string) => string;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const { contest, index, total, report, range, formatDate, t } = props;
  const totalMax = contest.problems.reduce(
    (sum, problem) => sum + problem.maxScore,
    0
  );
  const commentByPid = new Map(
    (report?.problemComments ?? []).map((item) => [item.pid, item.comment])
  );
  return (
    <section
      className="bg-card space-y-4 rounded-xl border p-4 shadow-xs sm:p-5"
      aria-labelledby={`contest-${contest.tid}`}
      data-llm-visible="true"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-teal-700 dark:text-teal-300 text-xs font-semibold tracking-widest">
            CONTEST {String(index + 1).padStart(2, '0')} /{' '}
            {String(total).padStart(2, '0')}
          </p>
          <h3
            id={`contest-${contest.tid}`}
            className="text-lg font-semibold"
            data-llm-text={contest.title}
          >
            {contest.title}
          </h3>
          <p className="text-muted-foreground text-xs">{range}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="secondary">{formatDate(contest.beginAt)}</Badge>
          <Badge variant="secondary">
            {Math.round((contest.durationMs / 3600000) * 10) / 10} h
          </Badge>
          <Badge variant="secondary">
            {t('report.participants', { count: contest.participantCount })}
          </Badge>
          <Badge variant="secondary">
            {t('report.maxScore', { score: formatScore(totalMax) })}
          </Badge>
        </div>
      </header>

      {report && (
        <div className="space-y-3">
          <div className="text-sm">
            <Markdown>{report.summary}</Markdown>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-3">
              <h4 className="text-xs font-medium">
                {t('report.difficultyComment')}
              </h4>
              <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                {report.difficultyComment}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-3">
              <h4 className="text-xs font-medium">
                {t('report.balanceComment')}
              </h4>
              <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line">
                {report.balanceComment}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="py-2 pr-3 font-medium">{t('report.position')}</th>
              <th className="py-2 pr-3 font-medium">{t('report.problem')}</th>
              <th className="py-2 pr-3 font-medium">
                {t('report.difficulty')}
              </th>
              <th className="py-2 pr-3 font-medium">{t('report.tags')}</th>
              <th className="py-2 pr-3 text-right font-medium">
                {t('report.passSubmit')}
              </th>
              <th className="py-2 pr-3 text-right font-medium">
                {t('report.fullScoreRate')}
              </th>
              <th className="py-2 text-right font-medium">
                {t('report.averageScore')}
              </th>
            </tr>
          </thead>
          <tbody>
            {contest.problems.map((problem, problemIndex) => (
              <tr
                key={problem.pid}
                className="border-b last:border-0 align-top"
              >
                <td className="py-2 pr-3 tabular-nums">T{problemIndex + 1}</td>
                <td className="py-2 pr-3">
                  <Link
                    className="font-medium hover:underline"
                    href={`/problem/${problem.pid}`}
                  >
                    {problem.title}
                  </Link>
                  {commentByPid.get(problem.pid) && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {commentByPid.get(problem.pid)}
                    </p>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className="inline-flex min-w-7 items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                    style={{
                      backgroundColor: difficultyCellClass(problem.difficulty),
                    }}
                    title={String(problem.difficulty)}
                  >
                    {problem.difficulty}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <span className="flex flex-wrap gap-1">
                    {problem.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-[11px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {problem.acceptCount} / {problem.attemptCount}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {problem.attemptCount
                    ? percentage(problem.acceptCount / problem.attemptCount)
                    : '—'}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatScore(problem.averageScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contest.tagOverlap.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-xs font-medium">{t('report.tagOverlap')}</h4>
          <div className="flex flex-wrap gap-2">
            {contest.tagOverlap.map((item) => (
              <Badge key={item.tag} variant="outline" className="text-xs">
                {item.tag}
                <span className="text-muted-foreground ml-1">
                  {item.pids
                    .map(
                      (pid) =>
                        `T${contest.problems.findIndex((problem) => problem.pid === pid) + 1}`
                    )
                    .join(' / ')}
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <ScoreDistribution
        context={t('report.distributionContext', { title: contest.title })}
        label={t('report.distributionSummary', {
          count: contest.participantCount,
          median: formatScore(contest.scoreStats.median),
          mean: formatScore(contest.scoreStats.mean),
          max: formatScore(contest.scoreStats.max),
        })}
        buckets={contest.scoreStats.buckets}
        bucketSize={50}
        maxTotal={totalMax}
        rangeLabel={(from, to) => t('report.scoreRange', { from, to })}
      />
    </section>
  );
}

function DifficultyMatrix({
  snapshot,
  difficultyNames,
  labels,
}: {
  snapshot: ContestAnalysisSnapshot;
  difficultyNames: string[];
  labels: {
    title: string;
    description: string;
    contest: string;
    duration: string;
    average: string;
    median: string;
    max: string;
  };
}) {
  return (
    <section
      className="space-y-3"
      aria-label={labels.title}
      data-llm-visible="true"
    >
      <div>
        <h2 className="text-base font-semibold">{labels.title}</h2>
        <p className="text-muted-foreground text-xs">{labels.description}</p>
      </div>
      <div className="bg-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-140 border-collapse text-sm">
          <thead>
            <tr className="text-muted-foreground border-b text-left text-xs">
              <th className="p-3 font-medium">{labels.contest}</th>
              {Array.from(
                {
                  length: Math.max(
                    ...snapshot.contests.map(
                      (contest) => contest.problems.length
                    ),
                    0
                  ),
                },
                (_, index) => (
                  <th key={index} className="p-3 text-center font-medium">
                    T{index + 1}
                  </th>
                )
              )}
              <th className="p-3 text-right font-medium">{labels.duration}</th>
              <th className="p-3 text-right font-medium">{labels.average}</th>
              <th className="p-3 text-right font-medium">{labels.median}</th>
              <th className="p-3 text-right font-medium">{labels.max}</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.contests.map((contest) => (
              <tr key={contest.tid} className="border-b last:border-0">
                <td
                  className="max-w-64 truncate p-3 font-medium"
                  title={contest.title}
                >
                  {contest.title}
                </td>
                {Array.from(
                  {
                    length: Math.max(
                      ...snapshot.contests.map((item) => item.problems.length),
                      0
                    ),
                  },
                  (_, index) => {
                    const difficulty = contest.difficultyGradient[index];
                    return (
                      <td key={index} className="p-3 text-center">
                        {difficulty ? (
                          <span
                            className="inline-flex min-w-7 items-center justify-center rounded px-1.5 py-0.5 text-xs font-semibold text-white"
                            style={{
                              backgroundColor: difficultyCellClass(difficulty),
                            }}
                            title={
                              difficultyNames[difficulty] ?? String(difficulty)
                            }
                          >
                            {difficulty}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  }
                )}
                <td className="p-3 text-right tabular-nums">
                  {Math.round((contest.durationMs / 3600000) * 10) / 10} h
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatScore(contest.scoreStats.mean)}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatScore(contest.scoreStats.median)}
                </td>
                <td className="p-3 text-right tabular-nums">
                  {formatScore(contest.scoreStats.max)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default async function ContestAnalysisReport({ job, canManage }: Props) {
  const t = await getTranslations('contest.analysis');
  const difficulty = await getTranslations('difficulty');
  const format = await getFormatter();
  const result = job.result;
  if (!result) return null;
  const { snapshot, report } = result;
  const contestReports = new Map(
    report.contests.map((item) => [item.tid, item])
  );
  const students = snapshot.students.length;
  const solvedTotal = snapshot.students.reduce(
    (sum, student) => sum + student.totals.solvedCount,
    0
  );
  const problemTotal = snapshot.students.reduce(
    (sum, student) => sum + student.totals.problemCount,
    0
  );

  return (
    <div className="space-y-6">
      <nav className="bg-background/90 sticky top-0 z-20 -mx-4 flex flex-wrap gap-1 border-b px-4 py-2 text-xs backdrop-blur print:hidden">
        <a className="hover:bg-accent rounded px-2 py-1" href="#overview">
          {t('nav.overview')}
        </a>
        <a className="hover:bg-accent rounded px-2 py-1" href="#evaluation">
          {t('nav.evaluation')}
        </a>
        <a className="hover:bg-accent rounded px-2 py-1" href="#contests">
          {t('nav.contests')}
        </a>
        {report.students.length > 0 && (
          <a className="hover:bg-accent rounded px-2 py-1" href="#students">
            {t('nav.students')}
          </a>
        )}
        <a className="hover:bg-accent rounded px-2 py-1" href="#tags">
          {t('nav.tags')}
        </a>
      </nav>

      <header
        id="overview"
        className="bg-card space-y-4 rounded-2xl border p-5 shadow-sm sm:p-6 scroll-mt-24"
        data-llm-visible="true"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-teal-700 dark:text-teal-300 text-[11px] font-semibold tracking-[0.2em]">
              {t('eyebrow')}
            </p>
            <h1
              className="text-2xl font-bold sm:text-3xl"
              data-llm-text={snapshot.title}
            >
              {snapshot.title}
            </h1>
            <p className="text-muted-foreground max-w-3xl text-sm">
              {t('heroDescription', {
                contests: snapshot.contests.length,
                problems: snapshot.contests.reduce(
                  (sum, contest) => sum + contest.problems.length,
                  0
                ),
                students,
              })}
            </p>
          </div>
          <ContestAnalysisActions
            jobId={job.jobId}
            status={job.status}
            canManage={canManage}
          />
        </div>

        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span>
            {t('generatedAt', {
              time: format.dateTime(new Date(snapshot.generatedAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })}
          </span>
          {job.model && <span>{t('modelLabel', { model: job.model })}</span>}
        </div>

        {report.overview.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {report.overview.keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary">
                {keyword}
              </Badge>
            ))}
          </div>
        )}

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: t('stats.contests'),
              value: String(snapshot.contests.length),
            },
            {
              label: t('stats.problems'),
              value: String(
                snapshot.contests.reduce(
                  (sum, contest) => sum + contest.problems.length,
                  0
                )
              ),
            },
            { label: t('stats.students'), value: String(students) },
            {
              label: t('stats.solveRate'),
              value: problemTotal
                ? percentage(solvedTotal / problemTotal)
                : '—',
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border bg-teal-50/40 p-3 dark:bg-teal-500/10"
            >
              <dt className="text-muted-foreground text-xs">{item.label}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <DifficultyMatrix
        snapshot={snapshot}
        difficultyNames={PROBLEMS_DIFFICULTY_KEYS.map((key) => difficulty(key))}
        labels={{
          title: t('matrix.title'),
          description: t('matrix.description'),
          contest: t('matrix.contest'),
          duration: t('matrix.duration'),
          average: t('matrix.average'),
          median: t('matrix.median'),
          max: t('matrix.max'),
        }}
      />

      <section
        id="evaluation"
        className="space-y-4 scroll-mt-24"
        aria-labelledby="evaluation-title"
        data-llm-visible="true"
      >
        <div>
          <h2
            id="evaluation-title"
            className="text-xl font-semibold"
            data-llm-text={t('evaluation.title')}
          >
            {t('evaluation.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('evaluation.description')}
          </p>
        </div>
        <div className="bg-card rounded-xl border p-4 shadow-xs sm:p-5">
          <div className="text-sm">
            <Markdown>{report.overview.summary}</Markdown>
          </div>
        </div>
        {report.overview.weakPoints.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            {report.overview.weakPoints.map((point) => (
              <article
                key={`${point.tag}-${point.summary}`}
                className="bg-card space-y-2 rounded-xl border p-4"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold" data-llm-text={point.tag}>
                    {point.tag}
                  </h3>
                  <Badge className={SEVERITY_CLASS[point.severity]}>
                    {t(`severity.${point.severity}`)}
                  </Badge>
                </header>
                <p className="text-sm">{point.summary}</p>
                <p className="text-muted-foreground text-xs">
                  <span className="font-medium">
                    {t('evaluation.evidence')}
                  </span>{' '}
                  {point.evidence}
                </p>
                {point.contests.length > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {t('evaluation.relatedContests', {
                      contests: point.contests.join('、'),
                    })}
                  </p>
                )}
                <p className="text-teal-700 dark:text-teal-300 text-xs">
                  <span className="font-medium">{t('evaluation.advice')}</span>{' '}
                  {point.advice}
                </p>
              </article>
            ))}
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="bg-card space-y-2 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">
              {t('evaluation.difficulty')}
            </h3>
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {report.overview.difficultyComment}
            </p>
          </div>
          <div className="bg-card space-y-2 rounded-xl border p-4">
            <h3 className="text-sm font-semibold">{t('evaluation.balance')}</h3>
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {report.overview.balanceComment}
            </p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {report.overview.highlights.length > 0 && (
            <div className="bg-card space-y-2 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">
                {t('evaluation.highlights')}
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-sm">
                {report.overview.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {report.overview.recommendations.length > 0 && (
            <div className="bg-card space-y-2 rounded-xl border p-4">
              <h3 className="text-sm font-semibold">
                {t('evaluation.recommendations')}
              </h3>
              <ol className="list-decimal space-y-1 pl-4 text-sm">
                {report.overview.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>

      <section
        id="contests"
        className="space-y-4 scroll-mt-24"
        aria-labelledby="contests-title"
      >
        <div>
          <h2
            id="contests-title"
            className="text-xl font-semibold"
            data-llm-text={t('contests.title')}
          >
            {t('contests.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('contests.description')}
          </p>
        </div>
        {snapshot.contests.map((contest, index) => (
          <ContestSection
            key={contest.tid}
            contest={contest}
            index={index}
            total={snapshot.contests.length}
            report={contestReports.get(contest.tid)}
            formatDate={(value) =>
              format.dateTime(new Date(value), { dateStyle: 'medium' })
            }
            t={t}
            range={t('contests.range', {
              from: format.dateTime(new Date(contest.beginAt), {
                dateStyle: 'medium',
              }),
              to: format.dateTime(new Date(contest.endAt), {
                dateStyle: 'medium',
              }),
            })}
          />
        ))}
      </section>

      {report.students.length > 0 && (
        <ContestAnalysisStudents
          reports={report.students}
          facts={snapshot.students}
          contests={snapshot.contests}
        />
      )}

      <section
        id="tags"
        className="space-y-3 scroll-mt-24"
        aria-labelledby="tags-title"
        data-llm-visible="true"
      >
        <div>
          <h2
            id="tags-title"
            className="text-xl font-semibold"
            data-llm-text={t('tags.title')}
          >
            {t('tags.title')}
          </h2>
          <p className="text-muted-foreground text-sm">
            {t('tags.description')}
          </p>
        </div>
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full min-w-160 border-collapse text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="p-3 font-medium">{t('tags.tag')}</th>
                <th className="p-3 text-right font-medium">
                  {t('tags.problems')}
                </th>
                <th className="p-3 text-right font-medium">
                  {t('tags.attempts')}
                </th>
                <th className="p-3 text-right font-medium">
                  {t('tags.students')}
                </th>
                <th className="p-3 text-right font-medium">
                  {t('tags.solveRate')}
                </th>
                <th className="p-3 text-right font-medium">
                  {t('tags.scoreRate')}
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.tags.map((tag) => (
                <tr key={tag.tag} className="border-b last:border-0">
                  <td className="p-3 font-medium">{tag.tag}</td>
                  <td className="p-3 text-right tabular-nums">
                    {tag.problemCount}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {tag.attemptCount}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {tag.studentCount}
                  </td>
                  <td
                    className={cn(
                      'p-3 text-right tabular-nums',
                      tag.solveRate < 0.3 && 'text-red-600 dark:text-red-400'
                    )}
                  >
                    {percentage(tag.solveRate)}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {tag.scoreRate.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
