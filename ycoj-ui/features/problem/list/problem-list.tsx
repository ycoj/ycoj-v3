'use client';

import type { ProblemListResponse } from '@/api/server/method/problems/list';
import { formatProblemPid } from '@/features/problem/lib/format-problem-pid';
import ProblemBulkToolbar from '@/features/problem/list/problem-bulk-toolbar';
import {
  serializeProblemFilters,
  type ProblemFilters,
} from '@/features/problem/list/problem-filter-utils';
import {
  reconcileSelection,
  selectableProblemIds,
  selectionCheckState,
  toggleSelectAll,
  toggleSelection,
} from '@/features/problem/list/problem-selection-utils';
import ProblemDifficulty from '@/features/problem/problem-difficulty';
import ProblemLink from '@/features/problem/problem-link';
import ProblemStatus from '@/features/problem/problem-status';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Progress } from '@/shared/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type Props = {
  data: ProblemListResponse;
  showTags: boolean;
  filters: ProblemFilters;
  domainId: string;
  /** PERM_EDIT_PROBLEM: every problem on the page can be managed. */
  canManageAll: boolean;
  /** PERM_EDIT_PROBLEM_SELF: the user can manage problems they own. */
  canManageOwn: boolean;
  userId?: number;
};

export default function ProblemList({
  data,
  showTags,
  filters,
  domainId,
  canManageAll,
  canManageOwn,
  userId,
}: Props) {
  const t = useTranslations('problem');
  const common = useTranslations('common');
  const editT = useTranslations('problemList.edit');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const canEdit = canManageAll || canManageOwn;
  const editableIds = useMemo(
    () =>
      selectableProblemIds(data.pdocs, {
        canManageAll,
        canManageOwn,
        userId,
      }),
    [canManageAll, canManageOwn, data.pdocs, userId]
  );
  // Selections that leave the page (navigation, refresh) are dropped so every
  // bulk action targets rows the user can still see.
  const effectiveSelection = useMemo(
    () => reconcileSelection(selected, editableIds),
    [selected, editableIds]
  );
  const checkState = selectionCheckState(effectiveSelection, editableIds);
  const columnCount = editing ? 7 : 6;
  // An open-ended count ("gte") is only a lower bound, so it is not shown.
  const resultSummary =
    data.pcountRelation === 'eq'
      ? common('problems', { count: data.pcount })
      : '';

  const leaveEditMode = () => {
    setEditing(false);
    setSelected([]);
  };

  const toggleShowTagsHref = `/problem?${new URLSearchParams({
    ...serializeProblemFilters(filters),
    showTags: String(!showTags),
  })}`;

  return (
    <div className="space-y-3">
      {!editing && (
        <div className="flex min-h-9 items-center justify-between gap-3">
          <p
            className="text-muted-foreground text-sm"
            data-llm-text={resultSummary}
          >
            {resultSummary}
          </p>
          {canEdit && (
            <Button
              variant="outline"
              type="button"
              onClick={() => setEditing(true)}
            >
              <Pencil className="text-muted-foreground" />
              <span data-llm-text={editT('enter')}>{editT('enter')}</span>
            </Button>
          )}
        </div>
      )}

      {editing && (
        <ProblemBulkToolbar
          selected={effectiveSelection}
          pdocs={data.pdocs}
          domainId={domainId}
          onClear={() => setSelected([])}
          onLeaveEditMode={leaveEditMode}
        />
      )}

      <Table className="table-fixed" data-llm-visible="true">
        <colgroup>
          {editing && <col className="w-10" />}
          <col className="w-12 md:w-32" />
          <col className="w-24" />
          <col />
          <col className="w-48" />
          <col className="w-28" />
          <col className="hidden w-24 md:table-column" />
        </colgroup>
        <TableHeader>
          <TableRow>
            {editing && (
              <TableCell className="px-2">
                <Checkbox
                  checked={checkState}
                  onCheckedChange={() =>
                    setSelected((current) =>
                      toggleSelectAll(
                        reconcileSelection(current, editableIds),
                        editableIds
                      )
                    )
                  }
                  aria-label={editT('selectAll')}
                />
              </TableCell>
            )}
            <TableCell>{common('status')}</TableCell>
            <TableCell>{common('problemId')}</TableCell>
            <TableCell>{common('problem')}</TableCell>
            <TableCell className="text-right">
              <Button variant="link" className="h-auto p-0 text-sm font-medium">
                <Link href={toggleShowTagsHref}>
                  {showTags ? t('hideTags') : t('showTags')}
                </Link>
              </Button>
            </TableCell>
            <TableCell className="text-center">{t('difficulty')}</TableCell>
            <TableCell className="hidden text-center md:table-cell">
              {t('acceptanceRate')}
            </TableCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.pdocs.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="text-muted-foreground py-10 text-center"
              >
                {t('none')}
              </TableCell>
            </TableRow>
          )}
          {data.pdocs.map((problem) => {
            const canManageRow = editableIds.includes(problem.docId);
            const selectedHere = effectiveSelection.includes(problem.docId);
            return (
              <TableRow
                key={problem.docId}
                data-state={selectedHere ? 'selected' : undefined}
              >
                {editing && (
                  <TableCell className="px-2">
                    {canManageRow && (
                      <Checkbox
                        checked={selectedHere}
                        onCheckedChange={() =>
                          setSelected((current) =>
                            toggleSelection(
                              reconcileSelection(current, editableIds),
                              problem.docId
                            )
                          )
                        }
                        aria-label={editT('selectProblem', {
                          pid: formatProblemPid(problem),
                        })}
                      />
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {data.psdict[problem.docId] && (
                    <ProblemStatus status={data.psdict[problem.docId]} />
                  )}
                </TableCell>
                <TableCell data-llm-text={formatProblemPid(problem)}>
                  {formatProblemPid(problem)}
                </TableCell>
                <TableCell>
                  <ProblemLink problem={problem} />
                </TableCell>
                <TableCell className="text-right">
                  {showTags && (
                    <div className="flex flex-wrap gap-2 justify-end">
                      {problem.tag.map((tag) => (
                        <Badge
                          variant="secondary"
                          key={tag}
                          data-llm-text={tag}
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <ProblemDifficulty difficulty={problem.difficulty} />
                </TableCell>
                <TableCell className="hidden text-center md:table-cell">
                  <Progress
                    className="h-2!"
                    value={
                      problem.nSubmit > 0
                        ? (problem.nAccept * 100) / problem.nSubmit
                        : 0
                    }
                    data-llm-text={`${
                      problem.nSubmit > 0
                        ? Math.round((problem.nAccept * 100) / problem.nSubmit)
                        : 0
                    }%`}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
