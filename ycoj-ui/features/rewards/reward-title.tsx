import { Badge } from '@/shared/components/ui/badge';
import { useTranslations } from 'next-intl';

export default function RewardTitle({ id }: { id?: string }) {
  const t = useTranslations('rewards');
  if (id !== 'title-explorer' && id !== 'title-persistent') return null;
  return (
    <Badge variant="secondary" className="shrink-0 text-xs">
      {t(`items.${id}.name`)}
    </Badge>
  );
}
