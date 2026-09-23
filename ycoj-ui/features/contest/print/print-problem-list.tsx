'use client';

import type { PrintableContest } from './model';
import type { PrintDraftActions } from './use-print-draft';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { FileText, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  data: ContestManagementResponse;
  /** The built document — problems render in print order. */
  document: PrintableContest;
  /** Current draft order (`overrides.problemOrder ?? tdoc.pids`). */
  order: number[];
  isDirty: boolean;
  actions: PrintDraftActions;
};

/**
 * Problem inclusion controls for the paper. Each problem is edited from its
 * own workspace tab.
 */
export default function PrintProblemList({
  data,
  document,
  order,
  isDirty,
  actions,
}: Props) {
  const t = useTranslations('contestPrint');
  // Candidates come from `tdoc.pids`, not `pdict` keys: the backend merges
  // string `pdoc.pid` keys (e.g. "P1001") into `pdict`, which would break a
  // numeric enumeration.
  const candidates = [...new Set(data.tdoc.pids)].filter(
    (id) => data.pdict[id] !== undefined && !order.includes(id)
  );
  const noProblems = data.tdoc.pids.length === 0;

  return (
    <section
      className="space-y-4"
      aria-label={t('problemsTitle')}
      data-llm-visible="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2
            className="text-lg font-semibold"
            data-llm-text={t('problemsTitle')}
          >
            {t('problemsTitle')}
          </h2>
          <p
            className="text-muted-foreground text-sm"
            data-llm-text={t('problemsDescription')}
          >
            {t('problemsDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value=""
            onValueChange={(value) => actions.addProblem(Number(value))}
            disabled={candidates.length === 0}
          >
            <SelectTrigger className="w-48" aria-label={t('addProblem')}>
              <SelectValue
                placeholder={
                  candidates.length > 0
                    ? t('addProblem')
                    : t('allProblemsAdded')
                }
              />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((problemId) => (
                <SelectItem key={problemId} value={String(problemId)}>
                  #{problemId} {data.pdict[problemId].title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={actions.restoreAllDefaults}
            disabled={!isDirty}
          >
            <RotateCcw />
            {t('restoreDefaults')}
          </Button>
        </div>
      </div>

      {document.problems.length === 0 && (
        <Empty className="border">
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle
              data-llm-text={
                noProblems ? t('emptyPdictTitle') : t('emptyProblemsTitle')
              }
            >
              {noProblems ? t('emptyPdictTitle') : t('emptyProblemsTitle')}
            </EmptyTitle>
            <EmptyDescription
              data-llm-text={
                noProblems
                  ? t('emptyPdictDescription')
                  : t('emptyProblemsDescription')
              }
            >
              {noProblems
                ? t('emptyPdictDescription')
                : t('emptyProblemsDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </section>
  );
}
