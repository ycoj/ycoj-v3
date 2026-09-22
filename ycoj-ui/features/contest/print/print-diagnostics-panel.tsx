'use client';

import type { PrintDiagnostic, PrintProblem } from './model';
import { problemLetter } from './print-draft';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { CircleAlert, Info, TriangleAlert, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Props = {
  diagnostics: PrintDiagnostic[];
  /** Printed problems, used to label diagnostics with their letter. */
  problems: PrintProblem[];
};

const SEVERITY_STYLES = {
  error: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-500',
  info: 'text-muted-foreground',
} as const;

const SEVERITY_ICONS = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
} as const;

/**
 * Dismissible list of build diagnostics. Dismissal stores the diagnostics
 * signature it applies to, so a changed diagnostics set always resurfaces.
 */
export default function PrintDiagnosticsPanel({
  diagnostics,
  problems,
}: Props) {
  const t = useTranslations('contestPrint');
  const [dismissedSignature, setDismissedSignature] = useState<string | null>(
    null
  );
  const signature = diagnostics
    .map(
      (item) =>
        `${item.severity}:${item.code}:${item.message}:${item.location?.problemId ?? ''}`
    )
    .join('\n');

  if (diagnostics.length === 0 || dismissedSignature === signature) {
    return null;
  }

  const labelFor = (problemId: number) => {
    const index = problems.findIndex(
      (problem) => problem.problemId === problemId
    );
    return index === -1 ? `#${problemId}` : problemLetter(index);
  };

  return (
    <section
      aria-label={t('diagnosticsTitle')}
      aria-live="polite"
      className="rounded-xl border px-4 py-3"
      data-llm-visible="true"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          className="text-sm font-medium"
          data-llm-text={t('diagnosticsTitle')}
        >
          {t('diagnosticsTitle')} ({diagnostics.length})
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setDismissedSignature(signature)}
          aria-label={t('dismissDiagnostics')}
        >
          <X />
        </Button>
      </div>
      <ul className="mt-1 space-y-1.5">
        {diagnostics.map((item, index) => {
          const Icon = SEVERITY_ICONS[item.severity];
          return (
            <li key={index} className="flex items-start gap-2 text-sm">
              <Icon
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  SEVERITY_STYLES[item.severity]
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="sr-only">
                  {t(`severity.${item.severity}`)}:{' '}
                </span>
                {item.location?.problemId !== undefined && (
                  <span className="text-muted-foreground mr-1.5 font-medium">
                    {labelFor(item.location.problemId)}
                  </span>
                )}
                <span data-llm-text={item.message}>{item.message}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
