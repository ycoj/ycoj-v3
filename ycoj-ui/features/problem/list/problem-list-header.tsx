import ProblemCreateOrImportDialog from './problem-create-or-import-dialog';
import { Button } from '@/shared/components/ui/button';
import { ListChecks, MessageSquareWarning } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  /** Main toolbar content, such as the problem search, shown before the actions. */
  children?: ReactNode;
  canCreate: boolean;
  canReview?: boolean;
  pendingSolutionCount?: number;
  canManageFeedback?: boolean;
};

export default function ProblemListHeader({
  children,
  canCreate,
  canReview = false,
  pendingSolutionCount = 0,
  canManageFeedback = false,
}: Props) {
  const t = useTranslations('problem');
  const reviewT = useTranslations('solution.review');

  const reviewLabel =
    pendingSolutionCount > 0
      ? reviewT('pendingCount', { count: pendingSolutionCount })
      : reviewT('title');
  const hasActions = canCreate || canReview || canManageFeedback;

  return (
    <header className="flex items-center gap-2" data-llm-visible="true">
      <div className="min-w-0 flex-1">{children}</div>
      {hasActions && (
        <div className="flex shrink-0 items-center gap-2">
          {canReview && (
            <Button
              asChild
              variant="outline"
              size="icon"
              className="relative"
              aria-label={reviewLabel}
              title={reviewLabel}
            >
              <Link href="/problem/solution-review" prefetch={false}>
                <ListChecks />
                {pendingSolutionCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
                  >
                    {pendingSolutionCount}
                  </span>
                )}
              </Link>
            </Button>
          )}
          {canManageFeedback && (
            <Button
              asChild
              variant="outline"
              size="icon"
              aria-label={t('feedbackManage')}
              title={t('feedbackManage')}
            >
              <Link href="/problem/feedback" prefetch={false}>
                <MessageSquareWarning />
              </Link>
            </Button>
          )}
          {canCreate && <ProblemCreateOrImportDialog />}
        </div>
      )}
    </header>
  );
}
