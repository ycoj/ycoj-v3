'use client';

import {
  bulkUpdateProblems,
  type ProblemBulkOperation,
} from '@/api/client/method/problem/batch';
import type { ProblemListResponse } from '@/api/server/method/problems/list';
import CopyProblemsDialog from '@/features/problem/copy/copy-problems-dialog';
import { availableBulkActions } from '@/features/problem/list/problem-selection-utils';
import { downloadProblemPackages } from '@/features/problem/package/download-problem-packages';
import ConfirmActionDialog from '@/shared/components/confirm-action-dialog';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Copy,
  Download,
  Eye,
  EyeOff,
  LoaderCircle,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  /** Problems the current user may change (all selected, or self-owned). */
  selected: number[];
  pdocs: ProblemListResponse['pdocs'];
  domainId: string;
  onClear: () => void;
  onLeaveEditMode: () => void;
};

function runBulk(operation: ProblemBulkOperation, pids: number[]) {
  return bulkUpdateProblems(operation, pids).send();
}

export default function ProblemBulkToolbar({
  selected,
  pdocs,
  domainId,
  onClear,
  onLeaveEditMode,
}: Props) {
  const t = useTranslations('problemList.bulk');
  const editT = useTranslations('problemList.edit');
  const router = useRouter();
  const [pending, setPending] = useState<ProblemBulkOperation | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadName, setDownloadName] = useState('');
  const actions = availableBulkActions(selected, pdocs);
  const busy = pending !== null || downloading;

  const execute = async (operation: 'hide' | 'unhide') => {
    if (busy || !selected.length) return;
    setPending(operation);
    try {
      const response = await runBulk(operation, selected);
      if (response && 'error' in response) {
        throw new Error(parseErrorMessage(response.error));
      }
      toast.success(
        t(operation === 'hide' ? 'hideSuccess' : 'unhideSuccess', {
          count: selected.length,
        })
      );
      onClear();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : t('failed')
      );
    } finally {
      setPending(null);
    }
  };

  // Deletion keeps the confirmation dialog open on failure so its own error
  // presentation shows the backend message.
  const remove = async () => {
    if (busy || !selected.length) return;
    setPending('delete');
    try {
      const response = await runBulk('delete', selected);
      if (response && 'error' in response) {
        throw new Error(parseErrorMessage(response.error));
      }
      toast.success(t('deleteSuccess', { count: selected.length }));
      onClear();
      router.refresh();
    } finally {
      setPending(null);
    }
  };

  const download = async () => {
    if (busy || !selected.length) return;
    setDownloading(true);
    try {
      await downloadProblemPackages(
        selected,
        domainId,
        downloadName.trim() ? `${downloadName.trim()}.zip` : undefined
      );
      toast.success(t('downloadSuccess'));
      setDownloadOpen(false);
      setDownloadName('');
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : t('failed')
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="bg-muted/40 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
      data-llm-visible="true"
    >
      <span
        className="text-sm font-medium tabular-nums"
        data-llm-text={editT('selected', { count: selected.length })}
      >
        {editT('selected', { count: selected.length })}
      </span>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions.canHide && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => void execute('hide')}
          >
            {pending === 'hide' ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <EyeOff />
            )}
            <span data-llm-text={t('hide')}>{t('hide')}</span>
          </Button>
        )}

        {actions.canUnhide && (
          <Button
            variant="outline"
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => void execute('unhide')}
          >
            {pending === 'unhide' ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Eye />
            )}
            <span data-llm-text={t('unhide')}>{t('unhide')}</span>
          </Button>
        )}

        {actions.canDownload && (
          <Dialog.Root
            open={downloadOpen}
            onOpenChange={(next) => {
              if (downloading) return;
              setDownloadOpen(next);
            }}
          >
            <Dialog.Trigger asChild>
              <Button variant="outline" size="sm" type="button" disabled={busy}>
                {downloading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Download />
                )}
                <span data-llm-text={t('download')}>{t('download')}</span>
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
              <Dialog.Content
                className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-xl"
                data-llm-visible="true"
              >
                <Dialog.Title
                  className="text-lg font-semibold"
                  data-llm-text={t('download')}
                >
                  {t('download')}
                </Dialog.Title>
                <Dialog.Description className="sr-only">
                  {editT('selected', { count: selected.length })}
                </Dialog.Description>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="problem-package-name">
                    {t('downloadName')}
                  </Label>
                  <Input
                    id="problem-package-name"
                    value={downloadName}
                    placeholder={t('downloadNamePlaceholder')}
                    onChange={(event) => setDownloadName(event.target.value)}
                  />
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button
                      variant="outline"
                      type="button"
                      disabled={downloading}
                    >
                      {t('cancel')}
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="button"
                    disabled={downloading}
                    onClick={() => void download()}
                  >
                    {downloading && <LoaderCircle className="animate-spin" />}
                    {t('downloadStart')}
                  </Button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        )}

        {actions.canCopy && (
          <CopyProblemsDialog
            pids={selected}
            onCopied={() => {
              onClear();
              router.refresh();
            }}
            trigger={
              <Button variant="outline" size="sm" type="button" disabled={busy}>
                <Copy />
                <span data-llm-text={t('copy')}>{t('copy')}</span>
              </Button>
            }
          />
        )}

        {actions.canDelete && (
          <ConfirmActionDialog
            title={t('deleteTitle')}
            description={t('deleteDescription', { count: selected.length })}
            confirmLabel={t('deleteConfirm')}
            pendingLabel={t('deleting')}
            cancelLabel={t('cancel')}
            fallbackError={t('failed')}
            onConfirm={remove}
            trigger={(isPending) => (
              <Button
                variant="destructive"
                size="sm"
                type="button"
                disabled={isPending || busy}
              >
                <Trash2 />
                <span data-llm-text={t('delete')}>{t('delete')}</span>
              </Button>
            )}
          />
        )}

        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onLeaveEditMode}
        >
          <X />
          <span data-llm-text={editT('leave')}>{editT('leave')}</span>
        </Button>
      </div>
    </div>
  );
}
