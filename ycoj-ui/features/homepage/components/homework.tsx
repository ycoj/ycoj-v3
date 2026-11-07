import { getRuntimeStatus } from '../homepage-status';
import RecentSectionCard from './recent-section-card';
import ContestStatus from '@/features/contest/contest-status';
import EntityHoverLink from '@/shared/components/entity-hover/entity-hover-link';
import TimeDurationBadge from '@/shared/components/time-duration-badge';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { ContestStatus as ContestStatusDoc } from '@/shared/types/contest';
import type { Homework } from '@/shared/types/homework';
import { Check, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  homeworks: Homework[];
  statusDict: Record<string, ContestStatusDoc> | undefined;
};

type HomeworkItemProps = {
  homework: Homework;
  attended: boolean;
};

function HomeworkItem({ homework, attended }: HomeworkItemProps) {
  const t = useTranslations('homework');
  const tHomepage = useTranslations('homepage');
  const status = getRuntimeStatus(homework.beginAt, homework.endAt);
  const deadline = homework.penaltySince ?? homework.endAt;

  return (
    <div data-llm-visible="true" className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <EntityHoverLink
          href={`/homework/${homework.docId}`}
          prefetch={false}
          data-llm-text={homework.title}
          className="text-foreground hover:text-primary overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap hover:underline"
        >
          {homework.title}
        </EntityHoverLink>
        <ContestStatus status={status} />
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <Badge variant="secondary" title={t('participants')}>
          <Users data-icon="inline-start" />
          <span
            data-llm-text={String(homework.attend)}
            className="tabular-nums"
          >
            {homework.attend}
          </span>
        </Badge>
        <TimeDurationBadge
          startTime={homework.beginAt}
          endTime={deadline}
          showDuration={false}
          dateStyle="short"
          timeRangeLabel={tHomepage('deadline')}
        />
        {attended && (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
          >
            <Check data-icon="inline-start" />
            <span data-llm-text={t('joined')}>{t('joined')}</span>
          </Badge>
        )}
      </div>
    </div>
  );
}

export default function HomeworkSection({ homeworks, statusDict }: Props) {
  const t = useTranslations('homepage');
  if (!homeworks.length) return null;

  return (
    <RecentSectionCard title={t('homework')} href="/homework">
      <div className="space-y-3">
        {homeworks.map((homework, index) => (
          <div
            key={homework.docId}
            className={cn(index !== homeworks.length - 1 && 'border-b pb-3')}
          >
            <HomeworkItem
              homework={homework}
              attended={Boolean(statusDict?.[homework.docId]?.attend)}
            />
          </div>
        ))}
      </div>
    </RecentSectionCard>
  );
}
