export type ProblemSelectionRow = {
  docId: number;
  hidden?: boolean;
};

export type ProblemSelectionState = {
  /** Numeric problem IDs on the current page. */
  ids: number[];
  selected: number[];
};

function uniqueIds(ids: number[]) {
  return Array.from(new Set(ids.filter((id) => Number.isSafeInteger(id))));
}

/**
 * Keeps only selections that are still on the current page and adds the
 * on-page IDs of a select-all action.
 */
export function reconcileSelection(
  selected: number[],
  pageIds: number[]
): number[] {
  const page = new Set(uniqueIds(pageIds));
  return uniqueIds(selected).filter((id) => page.has(id));
}

export function toggleSelection(selected: number[], id: number): number[] {
  return selected.includes(id)
    ? selected.filter((item) => item !== id)
    : [...selected, id];
}

export function toggleSelectAll(
  selected: number[],
  pageIds: number[]
): number[] {
  const ids = uniqueIds(pageIds);
  const page = new Set(ids);
  const allSelected =
    ids.length > 0 && ids.every((id) => selected.includes(id));
  if (allSelected) return selected.filter((id) => !page.has(id));
  return uniqueIds([...selected, ...ids]);
}

/**
 * Problems an owner may manage: `PERM_EDIT_PROBLEM` covers every problem,
 * otherwise `PERM_EDIT_PROBLEM_SELF` plus ownership (or maintainer status).
 */
export function selectableProblemIds(
  rows: Array<ProblemSelectionRow & { owner?: number; maintainer?: number[] }>,
  options: {
    canManageAll: boolean;
    canManageOwn: boolean;
    userId?: number;
  }
) {
  const { canManageAll, canManageOwn, userId } = options;
  return rows
    .filter((row) => {
      if (canManageAll) return true;
      if (!canManageOwn || userId === undefined) return false;
      return row.owner === userId || (row.maintainer ?? []).includes(userId);
    })
    .map((row) => row.docId);
}

export function selectionCheckState(selected: number[], pageIds: number[]) {
  const ids = uniqueIds(pageIds);
  const count = ids.filter((id) => selected.includes(id)).length;
  if (count === 0) return false;
  if (count === ids.length) return true;
  return 'indeterminate' as const;
}

/** The operations offered by the bulk toolbar for the current selection. */
export function availableBulkActions(
  selected: number[],
  rows: ProblemSelectionRow[]
) {
  const visible = new Set(
    selected.filter((id) => !rows.find((row) => row.docId === id)?.hidden)
  );
  const hidden = new Set(
    selected.filter((id) => rows.find((row) => row.docId === id)?.hidden)
  );
  return {
    canHide: visible.size > 0,
    canUnhide: hidden.size > 0,
    canDelete: selected.length > 0,
    canDownload: selected.length > 0,
    canCopy: selected.length > 0,
  };
}
