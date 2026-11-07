import {
  getTrainingCompletion,
  getTrainingProblemCount,
} from '../homepage-status';
import RecentSectionCard from './recent-section-card';
import EntityHoverLink from '@/shared/components/entity-hover/entity-hover-link';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/utils';
import type { TrainingDoc, TrainingStatusDict } from '@/shared/types/training';
import { BookOpen, Check, Code2, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  trainings: TrainingDoc[];
  statusDict: TrainingStatusDict | undefined;
  /** Whether the viewer can have enrolled; guests get no progress badge. */
  canEnroll: boolean;
};

function TrainingItem({
  training,
  status,
  canEnroll,
}: {
  training: TrainingDoc;
  status: TrainingStatusDict[string] | undefined;
  canEnroll: boolean;
}) {
  const t = useTranslations('training');
  const tHomepage = useTranslations('homepage');
  const common = useTranslations('common');
  const sectionCount = training.dag?.length ?? 0;
  const problemCount = getTrainingProblemCount(training.dag ?? []);
  const enrolled = Boolean(status?.enroll);

  return (
    <div data-llm-visible="true" className="space-y-1.5">
      <EntityHoverLink
        href={`/training/${training.docId}`}
        prefetch={false}
        data-llm-text={training.title}
        className="text-foreground hover:text-primary block overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap hover:underline"
      >
        {training.title}
      </EntityHoverLink>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
        <Badge variant="secondary" title={t('sectionCount')}>
          <BookOpen data-icon="inline-start" />
          <span data-llm-text={String(sectionCount)} className="tabular-nums">
            {common('sections', { count: sectionCount })}
          </span>
        </Badge>
        <Badge variant="secondary" title={t('problemCount')}>
          <Code2 data-icon="inline-start" />
          <span data-llm-text={String(problemCount)} className="tabular-nums">
            {common('problems', { count: problemCount })}
          </span>
        </Badge>
        <Badge variant="secondary" title={t('participants')}>
          <Users data-icon="inline-start" />
          <span
            data-llm-text={String(training.attend)}
            className="tabular-nums"
          >
            {training.attend}
          </span>
        </Badge>
        {enrolled ? (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400"
          >
            <Check data-icon="inline-start" />
            <span data-llm-text={t('joined')}>{t('joined')}</span>
          </Badge>
        ) : (
          canEnroll && (
            <span
              className="text-muted-foreground"
              data-llm-text={tHomepage('notEnrolled')}
            >
              {tHomepage('notEnrolled')}
            </span>
          )
        )}
      </div>
      {enrolled && (
        <p
          className="text-muted-foreground text-xs"
          data-llm-text={tHomepage('progress')}
        >
          {tHomepage('progress')}{' '}
          <span className="text-foreground tabular-nums">
            {getTrainingCompletion(status?.donePids, problemCount)}%
          </span>
        </p>
      )}
    </div>
  );
}

export default function TrainingSection({
  trainings,
  statusDict,
  canEnroll,
}: Props) {
  const t = useTranslations('homepage');
  if (!trainings.length) return null;

  return (
    <RecentSectionCard title={t('training')} href="/training">
      <div className="space-y-3">
        {trainings.map((training, index) => (
          <div
            key={training.docId}
            className={cn(index !== trainings.length - 1 && 'border-b pb-3')}
          >
            <TrainingItem
              training={training}
              status={statusDict?.[training.docId]}
              canEnroll={canEnroll}
            />
          </div>
        ))}
      </div>
    </RecentSectionCard>
  );
}
