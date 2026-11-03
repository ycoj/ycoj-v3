'use client';

import type { ProblemListResponse } from '@/api/server/method/problems/list';
import ProblemFilterBar from '@/features/problem/list/problem-filter-bar';
import type { ProblemFilters } from '@/features/problem/list/problem-filter-utils';
import ProblemList from '@/features/problem/list/problem-list';
import { Button } from '@/shared/components/ui/button';
import { Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type ReactNode } from 'react';

type Props = {
  /** Search header rendered above the filter row. */
  header?: ReactNode;
  filters: ProblemFilters;
  categories: Record<string, string[]>;
  namespaces: string[];
  data: ProblemListResponse;
  showTags: boolean;
  domainId: string;
  canManageAll: boolean;
  canManageOwn: boolean;
  userId?: number;
};

export default function ProblemListBrowse({
  header,
  filters,
  categories,
  namespaces,
  data,
  showTags,
  domainId,
  canManageAll,
  canManageOwn,
  userId,
}: Props) {
  const editT = useTranslations('problemList.edit');
  const [editing, setEditing] = useState(false);
  const canEdit = canManageAll || canManageOwn;

  return (
    <>
      <div className="space-y-3">
        {header}
        <ProblemFilterBar
          filters={filters}
          categories={categories}
          namespaces={namespaces}
          trailing={
            canEdit && !editing ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => setEditing(true)}
              >
                <Pencil className="text-muted-foreground" />
                <span data-llm-text={editT('enter')}>{editT('enter')}</span>
              </Button>
            ) : null
          }
        />
      </div>
      <ProblemList
        data={data}
        showTags={showTags}
        filters={filters}
        domainId={domainId}
        canManageAll={canManageAll}
        canManageOwn={canManageOwn}
        userId={userId}
        editing={editing}
        onLeaveEditMode={() => setEditing(false)}
      />
    </>
  );
}
