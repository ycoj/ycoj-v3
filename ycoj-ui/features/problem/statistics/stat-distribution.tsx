'use client';

import { STATUS, STATUS_BACKGROUND_COLOR } from '@/shared/configs/status';
import { useTranslations } from 'next-intl';

export type StatDistribution = {
  AC?: number;
  WA?: number;
  TLE?: number;
  MLE?: number;
  RE?: number;
  CE?: number;
};

export type ScoreDistribution = Record<string, number>;

const STATUS_BARS = [
  ['AC', STATUS.STATUS_ACCEPTED],
  ['WA', STATUS.STATUS_WRONG_ANSWER],
  ['TLE', STATUS.STATUS_TIME_LIMIT_EXCEEDED],
  ['MLE', STATUS.STATUS_MEMORY_LIMIT_EXCEEDED],
  ['RE', STATUS.STATUS_RUNTIME_ERROR],
  ['CE', STATUS.STATUS_COMPILE_ERROR],
] as const;

/**
 * Status distribution as labeled bars.
 *
 * Bars reuse the record status colors so the chart matches the rest of the
 * problem pages; the fixed category set does not justify a charting library.
 */
export function StatusDistribution({ stats }: { stats: StatDistribution }) {
  const t = useTranslations('problemOps.stats');
  const values = STATUS_BARS.map(([key, statusCode]) => ({
    key,
    value: stats[key] ?? 0,
    color: STATUS_BACKGROUND_COLOR[statusCode] ?? '#6b7280',
  }));
  const total = values.reduce((sum, item) => sum + item.value, 0);
  if (!total) return null;

  return (
    <div
      className="space-y-2"
      role="img"
      aria-label={t('statusChart')}
      data-llm-visible="true"
    >
      {values.map((item) => {
        const percent = Math.round((item.value / total) * 100);
        return (
          <div key={item.key} className="flex items-center gap-3 text-sm">
            <span className="w-10 shrink-0 font-mono">{item.key}</span>
            <div className="bg-muted h-3 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, backgroundColor: item.color }}
              />
            </div>
            <span
              className="text-muted-foreground w-16 shrink-0 text-right tabular-nums"
              data-llm-text={`${item.value} (${percent}%)`}
            >
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Score distribution as a compact histogram over ten-point buckets.
 *
 * Bucketing keeps very sparse distributions readable.
 */
export function ScoreDistributionView({
  scores,
}: {
  scores: ScoreDistribution;
}) {
  const t = useTranslations('problemOps.stats');
  const buckets = Array.from({ length: 10 }, (_, index) => {
    const lower = index * 10;
    let count = 0;
    for (let score = lower; score <= lower + 9; score += 1) {
      count += scores[`s${score}`] ?? 0;
    }
    return { lower, count };
  });
  const max = Math.max(...buckets.map((bucket) => bucket.count));
  if (!max) return null;

  return (
    <div
      className="flex h-40 items-end gap-2"
      role="img"
      aria-label={t('scoreChart')}
      data-llm-visible="true"
    >
      {buckets.map((bucket) => (
        <div
          key={bucket.lower}
          className="flex min-w-0 flex-1 flex-col items-center gap-1"
        >
          <div className="flex w-full flex-1 items-end">
            <div
              className="bg-primary/70 hover:bg-primary w-full rounded-t-sm transition-colors"
              style={{
                height: `${Math.max((bucket.count / max) * 100, bucket.count ? 4 : 0)}%`,
              }}
              title={`${bucket.lower}-${bucket.lower + 9}: ${bucket.count}`}
            />
          </div>
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {bucket.lower}
          </span>
        </div>
      ))}
    </div>
  );
}
