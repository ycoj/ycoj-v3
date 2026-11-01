'use client';

import type { PreviewableFileType } from '@/features/file/lib/previewable-file';
import PptxPreview from '@/features/problem/files/pptx-preview';
import { Button } from '@/shared/components/ui/button';
import type { FileInfo } from '@/shared/types/file';
import { LoaderCircle, TriangleAlert, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Dialog } from 'radix-ui';

type Props = {
  file: FileInfo | null;
  type: PreviewableFileType | null;
  url: string | null;
  error: string | null;
  loadingLabel: string;
  errorLabel: string;
  previewLabel: string;
  closeLabel: string;
  onOpenChange: (open: boolean) => void;
};

function PreviewSpinner({ label }: { label: string }) {
  return (
    <div
      className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function PreviewError({ label }: { label: string }) {
  return (
    <div
      className="flex size-full flex-col items-center justify-center gap-2 p-6 text-sm text-destructive"
      role="alert"
    >
      <TriangleAlert className="size-5" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

const DynamicReactPdfViewer = dynamic(
  () => import('@/shared/components/markdown/components/react-pdf-viewer'),
  {
    loading: () => (
      <div
        className="flex size-full items-center justify-center text-muted-foreground"
        role="status"
      >
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      </div>
    ),
    ssr: false,
  }
);

export default function FilePreviewDialog({
  file,
  type,
  url,
  error,
  loadingLabel,
  errorLabel,
  previewLabel,
  closeLabel,
  onOpenChange,
}: Props) {
  return (
    <Dialog.Root open={file !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-open:animate-in data-closed:animate-out fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
        <Dialog.Content
          aria-describedby={undefined}
          className="bg-background data-open:animate-in data-closed:animate-out fixed top-1/2 left-1/2 z-50 flex h-[min(90vh,56rem)] w-[min(96vw,75rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border p-4 outline-none"
          data-llm-visible="true"
        >
          <Dialog.Title
            className="min-w-0 pr-10 text-lg font-semibold"
            data-llm-text={
              file ? `${previewLabel}: ${file.name}` : previewLabel
            }
          >
            <span className="mr-2">{previewLabel}:</span>
            <span className="font-mono text-base font-normal">
              {file?.name}
            </span>
          </Dialog.Title>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute top-3 right-3"
            aria-label={closeLabel}
            onClick={() => onOpenChange(false)}
          >
            <X />
          </Button>
          <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded-md border">
            {error ? (
              <PreviewError label={errorLabel} />
            ) : !url ? (
              <PreviewSpinner label={loadingLabel} />
            ) : type === 'image' ? (
              <div className="flex size-full items-center justify-center overflow-auto bg-muted/60 p-4">
                {/* Signed file URLs cannot be known by next/image at build time. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={file?.name ?? previewLabel}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : type === 'pdf' ? (
              <DynamicReactPdfViewer key={url} src={url} />
            ) : type === 'pptx' ? (
              <PptxPreview key={url} src={url} />
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
