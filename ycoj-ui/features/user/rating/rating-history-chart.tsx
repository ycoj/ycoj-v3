'use client';

import RatingChange from './rating-change';
import type { UserContestRating } from '@/shared/types/rating';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

type Props = { history: UserContestRating['history'] };

export default function RatingHistoryChart({ history }: Props) {
  const t = useTranslations('user');
  const format = useFormatter();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [selectedTid, setSelectedTid] = useState<string>();
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(entry.contentRect.width)
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);

  if (!history.length) return null;
  // Reverse the server's newest-first history to retain its order for simultaneous contests.
  const entries = [...history].reverse();
  const selected =
    entries.find((entry) => entry.tid === selectedTid) ??
    entries[entries.length - 1];
  const values = [entries[0].before, ...entries.map((entry) => entry.after)];
  const min = Math.floor((Math.min(...values) - 50) / 50) * 50;
  const max = Math.ceil((Math.max(...values) + 50) / 50) * 50;
  const left = 52;
  const right = Math.max(left + 1, width - 16);
  const y = (value: number) => 16 + ((max - value) / (max - min)) * 176;
  const x = (index: number) =>
    left + ((index + 1) / entries.length) * (right - left);
  const points = [
    `${left},${y(entries[0].before)}`,
    ...entries.map((entry, index) => `${x(index)},${y(entry.after)}`),
  ].join(' ');
  const date = (value: string) =>
    format.dateTime(new Date(value), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <figure className="space-y-3 rounded-lg border p-3">
      <figcaption className="text-sm font-medium">
        {t('ratingHistory')}
      </figcaption>
      <div ref={container} className="min-w-0">
        <svg
          viewBox={`0 0 ${width} 208`}
          className="h-52 w-full overflow-visible"
          role="group"
          aria-label={t('ratingHistory')}
        >
          {[max, (min + max) / 2, min].map((tick) => (
            <g key={tick}>
              <line
                x1={left}
                x2={right}
                y1={y(tick)}
                y2={y(tick)}
                className="stroke-border"
              />
              <text
                x={left - 10}
                y={y(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-xs tabular-nums"
              >
                {format.number(tick, { maximumFractionDigits: 0 })}
              </text>
            </g>
          ))}
          <polyline
            points={points}
            fill="none"
            strokeWidth={2}
            strokeLinejoin="round"
            className="stroke-primary"
          />
          <circle
            cx={left}
            cy={y(entries[0].before)}
            r={3}
            className="fill-background stroke-muted-foreground"
          />
          {entries.map((entry, index) => {
            const label = t('ratingChartPoint', {
              title: entry.title,
              rating: format.number(entry.after),
              delta: format.number(entry.delta, { signDisplay: 'exceptZero' }),
            });
            return (
              <a
                key={entry.tid}
                href={`/contest/${entry.tid}/scoreboard`}
                aria-label={label}
                onFocus={() => setSelectedTid(entry.tid)}
                onPointerEnter={() => setSelectedTid(entry.tid)}
                className="group outline-none"
              >
                <title>{label}</title>
                <circle
                  cx={x(index)}
                  cy={y(entry.after)}
                  r={12}
                  className="fill-transparent"
                />
                <circle
                  cx={x(index)}
                  cy={y(entry.after)}
                  r={selected.tid === entry.tid ? 5 : 3.5}
                  strokeWidth={2}
                  className="fill-background stroke-primary group-focus-visible:fill-primary group-hover:fill-primary"
                />
              </a>
            );
          })}
        </svg>
        <div className="flex justify-between gap-3 pl-[52px] pr-4 text-xs text-muted-foreground tabular-nums">
          <span>
            {t('ratingStarting', { value: format.number(entries[0].before) })}
          </span>
          <span>{date(entries[entries.length - 1].endAt)}</span>
        </div>
      </div>
      <div
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3 text-sm"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="min-w-0 space-y-0.5">
          <Link
            href={`/contest/${selected.tid}/scoreboard`}
            prefetch={false}
            className="break-words font-medium hover:underline"
          >
            {selected.title}
          </Link>
          <p className="text-xs text-muted-foreground">
            {date(selected.endAt)}
          </p>
        </div>
        <div className="flex items-baseline gap-2 tabular-nums">
          <span className="font-medium">{format.number(selected.after)}</span>
          <RatingChange delta={selected.delta} />
        </div>
      </div>
    </figure>
  );
}
