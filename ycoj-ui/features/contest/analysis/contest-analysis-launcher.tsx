'use client';

import type { ContestListResponse } from '@/api/server/method/contests/list';
import ContestAnalysisDialog from '@/features/contest/analysis/contest-analysis-dialog';
import ContestList from '@/features/contest/list/contest-list';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import type { ContestListProjection } from '@/shared/types/contest';
import { CheckCheck, History, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const MAX_CONTESTS = 12;

type Props = {
  data: ContestListResponse;
  uid: number;
  canManageAll: boolean;
  canManageOwn: boolean;
};

export default function ContestAnalysisLauncher({
  data,
  uid,
  canManageAll,
  canManageOwn,
}: Props) {
  const t = useTranslations('contest.analysis');
  const router = useRouter();
  const [now] = useState(() => Date.now());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const isSelectable = (contest: ContestListProjection) => {
    if (new Date(contest.endAt).getTime() > now) return false;
    if (canManageAll) return true;
    if (!canManageOwn) return false;
    return (
      contest.owner === uid || (contest.maintainer?.includes(uid) ?? false)
    );
  };
  const selectableCount = data.tdocs.filter(isSelectable).length;
  const selectedContests = data.tdocs.filter((contest) =>
    selected.has(contest.docId)
  );

  const toggle = (docId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(docId)) next.delete(docId);
      else if (next.size < MAX_CONTESTS) next.add(docId);
      return next;
    });
  };

  const exitSelection = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  return (
    <div className="space-y-4">
      <ContestList
        data={data}
        selection={
          selecting ? { selected, onToggle: toggle, isSelectable } : undefined
        }
      />
      {(canManageAll || canManageOwn) && selectableCount > 0 && (
        <div className="pointer-events-none sticky bottom-4 z-30 flex justify-end">
          <div
            className={cn(
              'bg-background/95 pointer-events-auto flex items-center gap-3 rounded-full border px-3 py-2 shadow-lg backdrop-blur',
              !selecting && 'gap-2'
            )}
            data-llm-visible="true"
          >
            {selecting ? (
              <>
                <span
                  className="text-sm tabular-nums"
                  data-llm-text={t('selected', { count: selected.size })}
                >
                  {t('selected', { count: selected.size })}
                </span>
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {t('limitHint', { count: MAX_CONTESTS })}
                </span>
                <Button
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={() => setDialogOpen(true)}
                >
                  <Sparkles aria-hidden="true" />
                  {t('start')}
                </Button>
                <Button size="sm" variant="ghost" onClick={exitSelection}>
                  <X aria-hidden="true" />
                  {t('exitSelection')}
                </Button>
              </>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost">
                  <Link href="/contest/analysis">
                    <History aria-hidden="true" />
                    {t('history')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelecting(true)}
                >
                  <CheckCheck aria-hidden="true" />
                  {t('enterSelection')}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
      {dialogOpen && (
        <ContestAnalysisDialog
          contests={selectedContests}
          onClose={() => setDialogOpen(false)}
          onCreated={(jobId) => {
            setDialogOpen(false);
            router.push(`/contest/analysis/${jobId}`);
          }}
        />
      )}
    </div>
  );
}
