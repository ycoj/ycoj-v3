import { cn } from '@/shared/lib/utils';
import { useFormatter, useTranslations } from 'next-intl';

type Props = { delta: number; className?: string };

export default function RatingChange({ delta, className }: Props) {
  const format = useFormatter();
  const t = useTranslations('user');
  const value = format.number(delta, { signDisplay: 'exceptZero' });
  return (
    <span
      className={cn(
        'tabular-nums',
        delta > 0 && 'text-emerald-700 dark:text-emerald-400',
        delta < 0 && 'text-red-700 dark:text-red-400',
        delta === 0 && 'text-muted-foreground',
        className
      )}
      aria-label={t('ratingChangeValue', { value })}
    >
      {value}
    </span>
  );
}
