import {
  ScoreDistributionView,
  StatusDistribution,
  type ScoreDistribution,
  type StatDistribution,
} from './stat-distribution';
import StatFilter from './stat-filter';
import StatPerformanceTable from './stat-performance-table';
import { flattenStatLanguages } from './stat-selection';
import type {
  ProblemStatisticsData,
  ProblemStatRecord,
} from '@/api/server/method/problems/statistics';
import type { LanguageFamily } from '@/api/server/method/ui/languages';
import Pagination from '@/shared/components/pagination';
import type { ProblemStatSelection } from '@/shared/types/problem-statistics';
import { useTranslations } from 'next-intl';

type Props = {
  data: ProblemStatisticsData;
  selection: ProblemStatSelection;
  languages: Record<string, LanguageFamily>;
};

const SCORE_KEYS = Array.from({ length: 101 }, (_, index) => `s${index}`);

/**
 * Reads the stored status and score histograms.
 *
 * `pdoc.stats` is filled by the `problemStat` script and is absent when that
 * script has not run for this problem, so a missing object hides the chart.
 */
function readDistribution(stats: Record<string, number> | undefined): {
  status: StatDistribution;
  scores: ScoreDistribution;
} {
  if (!stats) return { status: {}, scores: {} };
  const scores: ScoreDistribution = {};
  for (const key of SCORE_KEYS) {
    if (typeof stats[key] === 'number') scores[key] = stats[key];
  }
  return {
    status: {
      AC: stats.AC,
      WA: stats.WA,
      TLE: stats.TLE,
      MLE: stats.MLE,
      RE: stats.RE,
      CE: stats.CE,
    },
    scores,
  };
}

const EMPTY_RECORDS: ProblemStatRecord[] = [];

export default function ProblemStatisticsContent({
  data,
  selection,
  languages,
}: Props) {
  const t = useTranslations('problemOps.stats');
  const records = data.rsdocs ?? EMPTY_RECORDS;
  const distribution = readDistribution(data.pdoc?.stats);
  const hasDistribution =
    Object.values(distribution.status).some((value) => (value ?? 0) > 0) ||
    Object.keys(distribution.scores).length > 0;
  const languageNames = Object.fromEntries(
    flattenStatLanguages(languages).map((language) => [
      language.name,
      language.display,
    ])
  );

  return (
    <div className="space-y-6" data-llm-visible="true">
      <section className="space-y-4 rounded-xl p-5 ring-1 ring-foreground/10">
        <h2 className="text-xl text-primary" data-llm-text={t('distribution')}>
          {t('distribution')}
        </h2>
        {hasDistribution ? (
          <div className="grid gap-6 md:grid-cols-2">
            <StatusDistribution stats={distribution.status} />
            <ScoreDistributionView scores={distribution.scores} />
          </div>
        ) : (
          <p
            className="text-muted-foreground text-sm"
            data-llm-text={t('distributionUnavailable')}
          >
            {t('distributionUnavailable')}
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-xl p-5 ring-1 ring-foreground/10">
        <div className="space-y-1">
          <h2 className="text-xl text-primary" data-llm-text={t('performance')}>
            {t('performance')}
          </h2>
          <p className="text-muted-foreground text-sm">{t('description')}</p>
        </div>

        <StatFilter
          key={`${selection.sort}:${selection.direction}:${selection.lang}`}
          selection={selection}
          languages={flattenStatLanguages(languages)}
        />

        {records.length ? (
          <>
            <p className="text-muted-foreground text-sm">
              {t('totalAccepted', { count: data.rscount ?? records.length })}
            </p>
            <StatPerformanceTable
              records={records}
              users={data.udict ?? {}}
              languageNames={languageNames}
            />
          </>
        ) : (
          <p
            className="text-muted-foreground py-6 text-center text-sm"
            data-llm-text={t('empty')}
          >
            {t('empty')}
          </p>
        )}
      </section>

      <Pagination page={data.page ?? selection.page} totalPages={data.pcount} />
    </div>
  );
}
