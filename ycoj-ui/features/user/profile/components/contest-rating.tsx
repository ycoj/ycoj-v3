import RatingChange from '@/features/user/rating/rating-change';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { UserContestRating } from '@/shared/types/rating';
import { useFormatter, useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = { rating?: UserContestRating | null };

export default function ContestRating({ rating }: Props) {
  const t = useTranslations('user');
  const format = useFormatter();
  return (
    <section className="space-y-3" data-llm-visible="true">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium">{t('contestRating')}</h2>
        {rating && (
          <p className="text-muted-foreground text-sm">
            {t('ratingPeak', { value: format.number(rating.peak) })} ·{' '}
            {t('ratedContests', { count: rating.contests })}
          </p>
        )}
      </div>
      {!rating ? (
        <p className="text-muted-foreground text-sm">{t('noRating')}</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-2xl font-semibold tabular-nums">
              {format.number(rating.rating)}
            </span>
            {rating.provisional && (
              <span className="text-muted-foreground text-sm">
                {t('ratingProvisional')}
              </span>
            )}
          </div>
          {rating.history.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('ratingContest')}</TableHead>
                  <TableHead>{t('ratingDate')}</TableHead>
                  <TableHead className="text-right">Rating</TableHead>
                  <TableHead className="text-right">
                    {t('ratingChange')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rating.history.map((entry) => (
                  <TableRow key={entry.tid}>
                    <TableCell className="max-w-56 whitespace-normal">
                      <Link
                        href={`/contest/${entry.tid}/scoreboard`}
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
          )}
        </>
      )}
    </section>
  );
}
