'use client';

import FilePreviewDialog from './file-preview-dialog';
import type { FileManagerLabels } from '@/features/file/lib/file-manager-labels';
import {
  getPreviewableFileType,
  type PreviewableFileType,
} from '@/features/file/lib/previewable-file';
import {
  DEFAULT_UPLOAD_LIMITS,
  validateUploadSelection,
  type UploadLimits,
} from '@/features/file/lib/validate-upload';
import { formatFileSize } from '@/features/problem/files/format-file-size';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Input } from '@/shared/components/ui/input';
import { Progress } from '@/shared/components/ui/progress';
import { formatRecordTime } from '@/shared/lib/format-time';
import type { FileInfo } from '@/shared/types/file';
import { Download, FileUp, Trash2 } from 'lucide-react';
import { AlertDialog, Dialog } from 'radix-ui';
import { useRef, useState } from 'react';

type Props = {
  files: FileInfo[];
  canManage: boolean;
  labels: FileManagerLabels;
  /** Same-origin URL that redirects to a signed download. */
  fileUrl: (name: string) => string;
  /** Resolves a signed URL for inline previews. */
  previewUrl: (name: string) => Promise<string>;
  onUpload: (file: File, onProgress: (ratio: number) => void) => Promise<void>;
  onDelete: (names: string[]) => Promise<void>;
  limits?: UploadLimits;
};

type ActiveUpload = {
  files: File[];
  progress: Map<File, number>;
};

type PreviewState = {
  name: string;
  type: PreviewableFileType;
  url: string | null;
  error: string | null;
};

export default function FileManager({
  files,
  canManage,
  labels,
  fileUrl,
  previewUrl,
  onUpload,
  onDelete,
  limits = DEFAULT_UPLOAD_LIMITS,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeUpload, setActiveUpload] = useState<ActiveUpload | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string[] | null>(null);
  const [error, setError] = useState('');
  const [rejections, setRejections] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const uploading = activeUpload !== null;
  const uploadWeight =
    activeUpload?.files.reduce(
      (total, file) => total + Math.max(file.size, 1),
      0
    ) ?? 0;
  const uploadedWeight =
    activeUpload?.files.reduce(
      (total, file) =>
        total + Math.max(file.size, 1) * (activeUpload.progress.get(file) ?? 0),
      0
    ) ?? 0;
  const uploadProgress = uploadWeight
    ? Math.round((uploadedWeight / uploadWeight) * 100)
    : 0;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const allSelected = files.length > 0 && selected.length === files.length;

  const openPreview = (name: string, type: PreviewableFileType) => {
    setPreview({ name, type, url: null, error: null });
    // The signed URL keeps PDF/PPTX previews independent from the redirect
    // endpoint, which browsers may block for nested cross-origin requests.
    void previewUrl(name)
      .then((url) => {
        setPreview((current) =>
          current?.name === name ? { ...current, url } : current
        );
      })
      .catch(() => {
        setPreview((current) =>
          current?.name === name
            ? { ...current, error: labels.previewError }
            : current
        );
      });
  };

  const previewFile = preview
    ? (files.find((file) => file.name === preview.name) ?? null)
    : null;

  const toggle = (name: string, checked: boolean) => {
    setSelected((current) =>
      checked
        ? [...new Set([...current, name])]
        : current.filter((item) => item !== name)
    );
  };

  const upload = async (selection: FileList | null) => {
    if (!selection?.length || uploading) return;
    const picked = Array.from(selection);
    if (inputRef.current) inputRef.current.value = '';

    const { accepted, rejected } = validateUploadSelection(
      picked,
      files,
      limits
    );
    setRejections(rejected.length ? labels.formatRejections(rejected) : '');
    if (!accepted.length) return;

    setError('');
    setActiveUpload({ files: accepted, progress: new Map() });
    let failed = 0;
    for (const file of accepted) {
      try {
        await onUpload(file, (ratio) => {
          setActiveUpload((current) => {
            if (!current) return current;
            const next = new Map(current.progress);
            next.set(file, Math.min(1, Math.max(0, ratio)));
            return { ...current, progress: next };
          });
        });
      } catch {
        failed += 1;
      }
    }
    setActiveUpload(null);
    if (failed) setError(labels.uploadFailed(failed, accepted.length));
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setError('');
    try {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
      setSelected([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : labels.actionFailed);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const download = (names: string[]) => {
    for (const name of names) {
      const anchor = document.createElement('a');
      anchor.href = fileUrl(name);
      anchor.download = name;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
    }
  };

  return (
    <section className="space-y-3" data-llm-visible="true">
      <div className="flex flex-wrap items-center justify-between gap-3 py-1">
        <h2 className="text-xl text-primary" data-llm-text={labels.title}>
          {labels.title}
        </h2>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              <FileUp />
              <span data-llm-text={labels.upload}>{labels.upload}</span>
            </Button>
            <Input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              aria-label={labels.upload}
              disabled={uploading}
              onChange={(event) => void upload(event.target.files)}
            />
          </div>
        )}
      </div>

      {error && (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
          data-llm-text={error}
        >
          {error}
        </p>
      )}

      {rejections && (
        <p
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm whitespace-pre-line text-amber-700 dark:text-amber-400"
          role="alert"
          data-llm-text={rejections}
        >
          {rejections}
        </p>
      )}

      {files.length ? (
        <>
          <div className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_8rem_5.5rem] items-center gap-3 border-y px-3 py-2 text-sm text-muted-foreground">
            <Checkbox
              checked={allSelected}
              aria-label={labels.selectAll}
              onCheckedChange={(checked) =>
                setSelected(
                  checked === true ? files.map((file) => file.name) : []
                )
              }
            />
            <span>{labels.fileNameLabel}</span>
            <span>{labels.size}</span>
            <span className="hidden text-right sm:block">
              {labels.modified}
            </span>
            <span className="sr-only">{labels.actions}</span>
          </div>
          <ul>
            {files.map((file) => {
              const previewType = getPreviewableFileType(file.name);
              return (
                <li
                  key={file.name}
                  className="grid grid-cols-[2rem_minmax(0,1fr)_5rem_8rem_5.5rem] items-center gap-3 border-b px-3 py-3 text-sm odd:bg-muted/30"
                >
                  <Checkbox
                    checked={selected.includes(file.name)}
                    aria-label={labels.selectFile(file.name)}
                    onCheckedChange={(value) =>
                      toggle(file.name, value === true)
                    }
                  />
                  {previewType ? (
                    <button
                      type="button"
                      className="min-w-0 cursor-pointer truncate text-left font-mono hover:text-primary hover:underline"
                      title={labels.preview}
                      aria-label={labels.previewFile(file.name)}
                      data-llm-text={file.name}
                      onClick={() => openPreview(file.name, previewType)}
                    >
                      {file.name}
                    </button>
                  ) : (
                    <span
                      className="min-w-0 truncate font-mono"
                      title={file.name}
                      data-llm-text={file.name}
                    >
                      {file.name}
                    </span>
                  )}
                  <span className="text-muted-foreground tabular-nums">
                    {formatFileSize(file.size)}
                  </span>
                  <span className="hidden text-right text-muted-foreground tabular-nums sm:block">
                    {formatFileTime(file.lastModified)}
                  </span>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      title={labels.download}
                      aria-label={labels.download}
                      onClick={() => download([file.name])}
                    >
                      <Download />
                    </Button>
                    {canManage && (
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="destructive"
                        title={labels.delete}
                        aria-label={labels.delete}
                        disabled={deleting}
                        onClick={() => setDeleteTarget([file.name])}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-2 border-b py-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!selected.length}
              onClick={() => download(selected)}
            >
              <Download />
              <span>{labels.downloadSelected}</span>
            </Button>
            {canManage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!selected.length || deleting}
                onClick={() => setDeleteTarget(selected)}
              >
                <Trash2 />
                <span>{labels.removeSelected}</span>
              </Button>
            )}
            <span
              className="text-muted-foreground ml-auto text-sm tabular-nums"
              data-llm-text={labels.totalSize(formatFileSize(totalSize))}
            >
              {labels.totalSize(formatFileSize(totalSize))}
            </span>
          </div>
        </>
      ) : (
        <div
          className="flex min-h-40 items-center justify-center border-y px-3 py-10 text-center text-sm text-muted-foreground"
          data-llm-text={labels.empty}
        >
          {labels.empty}
        </div>
      )}

      <FilePreviewDialog
        file={previewFile}
        type={preview?.type ?? null}
        url={preview?.url ?? null}
        error={preview?.error ?? null}
        loadingLabel={labels.previewLoading}
        errorLabel={labels.previewError}
        previewLabel={labels.preview}
        closeLabel={labels.close}
        onOpenChange={(open) => !open && setPreview(null)}
      />

      <Dialog.Root open={uploading} onOpenChange={() => undefined}>
        <Dialog.Portal>
          <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            aria-describedby={undefined}
            className="bg-background data-open:animate-in data-closed:animate-out fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 outline-none"
            data-llm-visible="true"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <Dialog.Title
              className="text-lg font-semibold"
              data-llm-text={labels.uploadingFiles(
                activeUpload?.files.length ?? 0
              )}
            >
              {labels.uploadingFiles(activeUpload?.files.length ?? 0)}
            </Dialog.Title>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span
                  className="text-muted-foreground"
                  data-llm-text={labels.uploadProgress}
                >
                  {labels.uploadProgress}
                </span>
                <span
                  className="font-medium tabular-nums"
                  data-llm-text={`${uploadProgress}%`}
                >
                  {uploadProgress}%
                </span>
              </div>
              <Progress
                className="h-2"
                value={uploadProgress}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
                aria-label={labels.uploadProgress}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AlertDialog.Root
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <AlertDialog.Content
            className="bg-background data-open:animate-in data-closed:animate-out fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 outline-none"
            data-llm-visible="true"
          >
            <AlertDialog.Title
              className="text-lg font-semibold"
              data-llm-text={labels.delete}
            >
              {labels.delete}
            </AlertDialog.Title>
            <AlertDialog.Description
              className="mt-2 text-sm text-muted-foreground"
              data-llm-text={labels.confirmDelete(deleteTarget?.length ?? 0)}
            >
              {labels.confirmDelete(deleteTarget?.length ?? 0)}
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <Button type="button" variant="outline" disabled={deleting}>
                  {labels.cancel}
                </Button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => void confirmDelete()}
                >
                  {deleting ? labels.deleting : labels.delete}
                </Button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}

function formatFileTime(value: Date | string | undefined) {
  if (!value) return '-';
  const ts = value instanceof Date ? value.getTime() : Date.parse(value);
  if (!Number.isFinite(ts)) return '-';
  return formatRecordTime(ts, 'YYYY-MM-DD');
}
