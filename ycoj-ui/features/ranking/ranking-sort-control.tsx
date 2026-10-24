import type { RankingSort } from '@/api/server/method/ranking/list';
import { Button } from '@/shared/components/ui/button';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  sort: RankingSort;
  canViewRating: boolean;
};

export default function RankingSortControl({ sort, canViewRating }: Props) {
  const t = useTranslations('ranking');
  if (!canViewRating) return null;
  const options = ['rp', 'rating'] as const;
  return (
    <nav aria-label={t('sortBy')} className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-sm text-muted-foreground">{t('sortBy')}</span>
      {options.map((value) => (
        <Button
          key={value}
          asChild
          variant={sort === value ? 'secondary' : 'ghost'}
        >
          <Link
            href={`/ranking?sort=${value}`}
            aria-current={sort === value ? 'page' : undefined}
          >
            {t(value)}
          </Link>
        </Button>
      ))}
    </nav>
  );
}
