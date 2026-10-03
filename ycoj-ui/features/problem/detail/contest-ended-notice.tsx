'use client';

import type { ProblemDetailMode } from '@/api/server/method/problems/detail';
import { getContestEndedVariant } from '@/features/problem/detail/contest-ended-mode';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  mode: ProblemDetailMode | undefined;
};

/** Tells the reader that the contest is over and submissions belong elsewhere. */
export default function ContestEndedNotice({ mode }: Props) {
  const t = useTranslations('problem');
  const variant = getContestEndedVariant(mode);
  if (!variant) return null;

  return (
    <Alert
      data-llm-visible="true"
      className="border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-50"
    >
      <Info strokeWidth={2} className="text-current" />
      <AlertTitle data-llm-text={t('contestEndedTitle')}>
        {t('contestEndedTitle')}
      </AlertTitle>
      <AlertDescription>
        {variant === 'view'
          ? t('contestEndedView')
          : t('contestEndedCorrection')}
      </AlertDescription>
    </Alert>
  );
}
