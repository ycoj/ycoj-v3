'use client';

import type { PrintableContest, PrintProblemOverrides } from './model';
import { problemLetter } from './print-draft';
import PrintProblemEditor from './print-problem-editor';
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
import { useRef } from 'react';

type Props = {
  data: ContestManagementResponse;
  /** The built document — problems render in print order. */
  document: PrintableContest;
  /** Current draft order (`overrides.problemOrder ?? tdoc.pids`). */
  order: number[];
  /** `overrides.problems ?? {}` — drives the modified badge/restore state. */
  problemOverrides: Record<number, PrintProblemOverrides>;
  isDirty: boolean;
  actions: PrintDraftActions;
};

/**
 * The printed problem list: ordered, lettered problem cards plus the
 * add-problem picker and the global restore-defaults action.
 */
export default function PrintProblemList({
  data,
  document,
  order,
  problemOverrides,
  isDirty,
  actions,
}: Props) {
  const t = useTranslations('contestPrint');
  const addProblemRef = useRef<HTMLButtonElement>(null);
  const candidates = Object.keys(data.pdict)
    .map(Number)
    .filter((id) => !order.includes(id));
  const pdictEmpty = Object.keys(data.pdict).length === 0;

  /**
   * Removing a card unmounts the focused button, which would drop focus to
   * <body>. Park it on the add-problem picker instead — the removal always
   * makes it enabled, and it is the natural next control for the list.
   */
  const removeProblem = (problemId: number) => {
    actions.removeProblem(problemId);
    requestAnimationFrame(() => addProblemRef.current?.focus());
  };

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
            <SelectTrigger
              ref={addProblemRef}
              className="w-48"
              aria-label={t('addProblem')}
            >
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

      {document.problems.length === 0 ? (
        <Empty className="border">
          <EmptyMedia variant="icon">
            <FileText />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle
              data-llm-text={
                pdictEmpty ? t('emptyPdictTitle') : t('emptyProblemsTitle')
              }
            >
              {pdictEmpty ? t('emptyPdictTitle') : t('emptyProblemsTitle')}
            </EmptyTitle>
            <EmptyDescription
              data-llm-text={
                pdictEmpty
                  ? t('emptyPdictDescription')
                  : t('emptyProblemsDescription')
              }
            >
              {pdictEmpty
                ? t('emptyPdictDescription')
                : t('emptyProblemsDescription')}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="space-y-3">
          {document.problems.map((problem, index) => {
            const problemId = problem.problemId;
            const hasOverrides =
              Object.keys(problemOverrides[problemId] ?? {}).length > 0;
            return (
              <li key={problemId}>
                <PrintProblemEditor
                  problem={problem}
                  letter={problemLetter(index)}
                  isFirst={index === 0}
                  isLast={index === document.problems.length - 1}
                  showFileIo={document.fileIo}
                  showPretest={document.usePretest}
                  languages={document.languages}
                  hasOverrides={hasOverrides}
                  onPatch={(patch) => actions.updateProblem(problemId, patch)}
                  onMoveUp={() => actions.moveProblem(problemId, 'up')}
                  onMoveDown={() => actions.moveProblem(problemId, 'down')}
                  onRemove={() => removeProblem(problemId)}
                  onRestore={() => actions.restoreProblemDefaults(problemId)}
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
