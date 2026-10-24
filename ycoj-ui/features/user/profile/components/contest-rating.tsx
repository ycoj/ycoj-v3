import RatingHistoryChart from '@/features/user/rating/rating-history-chart';
import RatingHistoryTable from '@/features/user/rating/rating-history-table';
import type { UserContestRating } from '@/shared/types/rating';
import { TrendingUp } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

type Props = { rating?: UserContestRating | null };

export default function ContestRating({ rating }: Props) {
  const t = useTranslations('user');
  const format = useFormatter();
  return (
    <section className="space-y-3" data-llm-visible="true">
      <h2 className="inline-flex items-center gap-2 text-base font-medium">
        <TrendingUp className="size-4 text-muted-foreground" />
        <span data-llm-text={t('contestRating')}>{t('contestRating')}</span>
      </h2>
      {!rating ? (
        <p className="text-muted-foreground text-sm">{t('noRating')}</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
            {[
              {
                label: t('ratingCurrent'),
                value: format.number(rating.rating),
              },
              {
                label: t('ratingPeakLabel'),
                value: format.number(rating.peak),
              },
              {
                label: t('ratingContestsLabel'),
                value: format.number(rating.contests),
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-background px-3 py-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                  className="text-sm font-medium tabular-nums"
                  data-llm-text={value}
                >
                  {value}
                </p>
              </div>
            ))}
          </div>
          {rating.provisional && (
            <p className="text-sm text-muted-foreground">
              {t('ratingProvisional')}
            </p>
          )}
          {rating.history.length > 0 && (
            <>
              <RatingHistoryChart history={rating.history} />
              <RatingHistoryTable history={rating.history} />
            </>
          )}
        </>
      )}
    </section>
  );
}
