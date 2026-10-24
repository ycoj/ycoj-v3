'use client';

import RatingChange from './rating-change';
import { Button } from '@/shared/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { UserContestRating } from '@/shared/types/rating';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useId, useState } from 'react';

type Props = { history: UserContestRating['history'] };

export default function RatingHistoryTable({ history }: Props) {
  const t = useTranslations('user');
  const format = useFormatter();
  const [expanded, setExpanded] = useState(false);
  const tableId = useId();
  const entries = expanded ? history : history.slice(0, 3);
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table id={tableId}>
        <TableHeader>
          <TableRow>
            <TableHead>{t('ratingContest')}</TableHead>
            <TableHead>{t('ratingDate')}</TableHead>
            <TableHead className="text-right">Rating</TableHead>
            <TableHead className="text-right">{t('ratingChange')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.tid}>
              <TableCell className="max-w-56 whitespace-normal">
                <Link
                  href={`/contest/${entry.tid}/scoreboard`}
                  prefetch={false}
                  className="hover:underline"
                >
                  {entry.title}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {format.dateTime(new Date(entry.endAt), {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {format.number(entry.after)}
              </TableCell>
              <TableCell className="text-right">
                <RatingChange delta={entry.delta} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {history.length > 3 && (
        <div className="border-t p-1">
          <Button
            variant="ghost"
            className="w-full"
            aria-expanded={expanded}
            aria-controls={tableId}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded
              ? t('ratingCollapseHistory')
              : t('ratingExpandHistory', { count: history.length })}
            {expanded ? (
              <ChevronUp aria-hidden="true" />
            ) : (
              <ChevronDown aria-hidden="true" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
