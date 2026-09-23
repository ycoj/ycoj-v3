'use client';

import { buildPrintableContest } from './build-printable-contest';
import type {
  PrintDiagnostic,
  PrintableContest,
  PrintProblemOverrides,
} from './model';
import {
  addDraftProblem,
  applyContestPatch,
  applyProblemPatch,
  isDraftDirty,
  moveDraftProblem,
  removeDraftProblem,
  restoreDraftDefaults,
  restoreDraftProblem,
  type PrintContestPatch,
  type PrintDraft,
  type PrintMoveDirection,
} from './print-draft';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';

export type PrintDraftActions = {
  /** Merge contest-level fields; `undefined` values clear the override. */
  updateContest: (patch: PrintContestPatch) => void;
  /** Merge a sparse patch into one problem's overrides. */
  updateProblem: (problemId: number, patch: PrintProblemOverrides) => void;
  /** Keyboard-friendly reorder: swap a problem with its neighbor. */
  moveProblem: (problemId: number, direction: PrintMoveDirection) => void;
  /** Drop a problem from the printed list (its overrides are kept). */
  removeProblem: (problemId: number) => void;
  /** Append a `pdict` problem that is not in the current order. */
  addProblem: (problemId: number) => void;
  /** Clear one problem's overrides. */
  restoreProblemDefaults: (problemId: number) => void;
  /** Clear every override. */
  restoreAllDefaults: () => void;
};

export type PrintDraftState = {
  /** The built paper — everything the editor displays is derived from it. */
  document: PrintableContest;
  /** Build diagnostics for the current draft. */
  diagnostics: PrintDiagnostic[];
  /** The sparse overrides backing the current document. */
  overrides: PrintDraft;
  /** Whether the draft differs from the derived defaults. */
  isDirty: boolean;
  actions: PrintDraftActions;
};

/**
 * Draft-only editor state: the overrides object is the single source of
 * truth and the document is rebuilt (memoized on `[response, overrides]`)
 * after every action. Nothing is persisted — this is a local draft.
 */
export function usePrintDraft(
  response: ContestManagementResponse
): PrintDraftState {
  const [overrides, setOverrides] = useState<PrintDraft>({});
  const tProblemType = useTranslations('problemType');

  /**
   * `pdoc.config.type` → localized label, so the printed paper shows
   * e.g. `传统题` instead of the raw judge id `default`/`remote_judge`.
   */
  const problemTypeLabels = useMemo<Record<string, string>>(
    () => ({
      default: tProblemType('default'),
      traditional: tProblemType('default'),
      objective: tProblemType('objective'),
      submit_answer: tProblemType('submitAnswer'),
      fileio: tProblemType('fileIo'),
      interactive: tProblemType('interactive'),
      communication: tProblemType('communication'),
      remote_judge: tProblemType('remoteJudge'),
    }),
    [tProblemType]
  );

  const { document, diagnostics } = useMemo(
    () => buildPrintableContest(response, { overrides, problemTypeLabels }),
    [response, overrides, problemTypeLabels]
  );

  const isDirty = useMemo(
    () => isDraftDirty(overrides, response),
    [overrides, response]
  );

  const updateContest = useCallback(
    (patch: PrintContestPatch) =>
      setOverrides((draft) => applyContestPatch(draft, patch)),
    []
  );
  const updateProblem = useCallback(
    (problemId: number, patch: PrintProblemOverrides) =>
      setOverrides((draft) => applyProblemPatch(draft, problemId, patch)),
    []
  );
  const moveProblem = useCallback(
    (problemId: number, direction: PrintMoveDirection) =>
      setOverrides((draft) =>
        moveDraftProblem(draft, response, problemId, direction)
      ),
    [response]
  );
  const removeProblem = useCallback(
    (problemId: number) =>
      setOverrides((draft) => removeDraftProblem(draft, response, problemId)),
    [response]
  );
  const addProblem = useCallback(
    (problemId: number) =>
      setOverrides((draft) => addDraftProblem(draft, response, problemId)),
    [response]
  );
  const restoreProblemDefaults = useCallback(
    (problemId: number) =>
      setOverrides((draft) => restoreDraftProblem(draft, problemId)),
    []
  );
  const restoreAllDefaults = useCallback(
    () => setOverrides(restoreDraftDefaults()),
    []
  );

  const actions = useMemo<PrintDraftActions>(
    () => ({
      updateContest,
      updateProblem,
      moveProblem,
      removeProblem,
      addProblem,
      restoreProblemDefaults,
      restoreAllDefaults,
    }),
    [
      updateContest,
      updateProblem,
      moveProblem,
      removeProblem,
      addProblem,
      restoreProblemDefaults,
      restoreAllDefaults,
    ]
  );

  return { document, diagnostics, overrides, isDirty, actions };
}
