import type {
  PrintableContest,
  PrintContestOverrides,
  PrintProblemOverrides,
} from './model';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';

/**
 * Draft state for the print editor is exactly the sparse overrides object
 * consumed by `buildPrintableContest`: contest-level fields override the
 * derived values, `problemOrder` replaces `tdoc.pids`, and `problems` holds
 * per-problem patches. All helpers here are pure and Node-safe so the draft
 * semantics can be unit-tested without React.
 */
export type PrintDraft = PrintContestOverrides;

/** Contest-level patch: every printable field except the problem list. */
export type PrintContestPatch = Partial<Omit<PrintableContest, 'problems'>>;

export type PrintMoveDirection = 'up' | 'down';

/** `tdoc.pids` is the order the paper prints when no override is present. */
function defaultProblemOrder(response: ContestManagementResponse): number[] {
  return response.tdoc.pids;
}

/** The effective problem order for a draft (override or default). */
export function draftProblemOrder(
  draft: PrintDraft,
  response: ContestManagementResponse
): number[] {
  return draft.problemOrder ?? defaultProblemOrder(response);
}

/**
 * Order comparison follows builder semantics: the build dedupes ids, so a
 * `problemOrder` that dedupes to `tdoc.pids` produces the default document.
 */
function sameIdOrder(a: readonly number[], b: readonly number[]): boolean {
  const left = [...new Set(a)];
  const right = [...new Set(b)];
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

/** Drop bookkeeping keys that cannot affect the built document. */
function normalizeDraft(draft: PrintDraft): PrintDraft {
  const next = { ...draft };
  if (next.problems && Object.keys(next.problems).length === 0) {
    delete next.problems;
  }
  return next;
}

/**
 * Merge contest-level fields into the draft. A `undefined` value removes the
 * override, restoring the derived default for that field.
 */
export function applyContestPatch(
  draft: PrintDraft,
  patch: PrintContestPatch
): PrintDraft {
  const next = { ...draft } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return normalizeDraft(next as PrintDraft);
}

/**
 * Merge a sparse patch into one problem's overrides. `undefined` values
 * remove individual keys; a problem whose override object becomes empty is
 * dropped from `problems` entirely (it prints exactly as derived).
 */
export function applyProblemPatch(
  draft: PrintDraft,
  problemId: number,
  patch: PrintProblemOverrides
): PrintDraft {
  const problems = { ...(draft.problems ?? {}) };
  const merged = { ...(problems[problemId] ?? {}) } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  const overrides = merged as PrintProblemOverrides;
  if (Object.keys(overrides).length === 0) {
    delete problems[problemId];
  } else {
    problems[problemId] = overrides;
  }
  return normalizeDraft({ ...draft, problems });
}

/** Swap a problem with its neighbor; out-of-range moves are no-ops. */
export function moveDraftProblem(
  draft: PrintDraft,
  response: ContestManagementResponse,
  problemId: number,
  direction: PrintMoveDirection
): PrintDraft {
  const order = draftProblemOrder(draft, response);
  const index = order.indexOf(problemId);
  const target = direction === 'up' ? index - 1 : index + 1;
  if (index === -1 || target < 0 || target >= order.length) return draft;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return { ...draft, problemOrder: next };
}

/**
 * Remove a problem from the printed list. Its overrides are kept, so adding
 * the problem back restores the edits (the build surfaces the kept overrides
 * as an info diagnostic while the problem is absent).
 */
export function removeDraftProblem(
  draft: PrintDraft,
  response: ContestManagementResponse,
  problemId: number
): PrintDraft {
  const order = draftProblemOrder(draft, response);
  if (!order.includes(problemId)) return draft;
  return {
    ...draft,
    problemOrder: order.filter((id) => id !== problemId),
  };
}

/** Append a `pdict` problem to the end of the printed list. */
export function addDraftProblem(
  draft: PrintDraft,
  response: ContestManagementResponse,
  problemId: number
): PrintDraft {
  if (!response.pdict[problemId]) return draft;
  const order = draftProblemOrder(draft, response);
  if (order.includes(problemId)) return draft;
  return { ...draft, problemOrder: [...order, problemId] };
}

/** Clear one problem's overrides, restoring every derived field. */
export function restoreDraftProblem(
  draft: PrintDraft,
  problemId: number
): PrintDraft {
  if (!draft.problems?.[problemId]) return draft;
  const problems = { ...draft.problems };
  delete problems[problemId];
  return normalizeDraft({ ...draft, problems });
}

/** Clear the whole draft — every field falls back to derived defaults. */
export function restoreDraftDefaults(): PrintDraft {
  return {};
}

const CONTEST_OVERRIDE_KEYS = [
  'language',
  'title',
  'subtitle',
  'dayName',
  'dateText',
  'beginAt',
  'endAt',
  'notice',
  'noiStyle',
  'fileIo',
  'usePretest',
  'languages',
] as const;

/**
 * Whether the draft changes the printed document. A `problemOrder` equal to
 * `tdoc.pids`, empty per-problem override objects, and an empty
 * `extraSections` list are no-ops and count as clean.
 */
export function isDraftDirty(
  draft: PrintDraft,
  response: ContestManagementResponse
): boolean {
  const order = draft.problemOrder;
  if (order !== undefined && !sameIdOrder(order, response.tdoc.pids)) {
    return true;
  }
  if (
    draft.problems &&
    Object.values(draft.problems).some(
      (overrides) => Object.keys(overrides).length > 0
    )
  ) {
    return true;
  }
  // `extraSections: []` builds the same document as no override.
  if (draft.extraSections !== undefined && draft.extraSections.length > 0) {
    return true;
  }
  for (const key of CONTEST_OVERRIDE_KEYS) {
    if (draft[key] !== undefined) return true;
  }
  return false;
}

/**
 * CNOI-style problem letter by print position: A, B, C … Problems past Z
 * fall back to `#N` so long contests still get a stable label.
 */
export function problemLetter(index: number): string {
  if (index < 0 || index > 25) return `#${index + 1}`;
  return String.fromCharCode(65 + index);
}

/** Next unused `section-N` id for a new extra section. */
export function nextExtraSectionId(
  sections: readonly { id: string }[]
): string {
  const used = new Set(sections.map((section) => section.id));
  let index = 1;
  while (used.has(`section-${index}`)) index += 1;
  return `section-${index}`;
}
