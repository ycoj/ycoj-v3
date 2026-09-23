'use client';

import type { PrintAssetProvider } from './assets';
import type {
  CreatePrintCompiler,
  PrintCompiler,
  PrintCompilerProgress,
  PrintSupport,
} from './compiler';
import type { PrintDiagnostic, PrintableContest } from './model';
import PrintDiagnosticsPanel from './print-diagnostics-panel';
import { downloadUrl, printPdfFileName } from './print-download';
import {
  createTypstPrintCompiler,
  type TypstPrintCompilerOptions,
} from './typst-compiler';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { Progress } from '@/shared/components/ui/progress';
import { cn } from '@/shared/lib/utils';
import {
  CircleAlert,
  Download,
  FileText,
  LoaderCircle,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';

function PdfPreviewLoading() {
  return (
    <div className="flex size-full items-center justify-center" role="status">
      <LoaderCircle
        className="size-5 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}

const ReactPdfViewer = dynamic(
  () => import('@/shared/components/markdown/components/react-pdf-viewer'),
  { loading: PdfPreviewLoading, ssr: false }
);

type Props = {
  tid: string;
  document: PrintableContest;
  support: PrintSupport | null;
  assetProvider: PrintAssetProvider;
  createCompiler?: CreatePrintCompiler;
};

type RunningPhase = 'init' | 'compile';

/**
 * Live preview with latest-draft behavior. The first compile starts after the
 * client support check; subsequent edits are debounced while the current PDF
 * remains visible. Failed recompiles never discard the last good preview.
 */
export default function PrintPreviewPanel({
  tid,
  document,
  support,
  assetProvider,
  createCompiler = createTypstPrintCompiler,
}: Props) {
  const t = useTranslations('contestPrint');
  const compilerRef = useRef<PrintCompiler | null>(null);
  const pdfUrlRef = useRef<string | null>(null);
  const documentRef = useRef(document);
  const runIdRef = useRef(0);
  const autoSignatureRef = useRef<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [running, setRunning] = useState<RunningPhase | null>(null);
  const [progress, setProgress] = useState<PrintCompilerProgress | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [compileDiagnostics, setCompileDiagnostics] = useState<
    PrintDiagnostic[]
  >([]);

  useEffect(() => {
    documentRef.current = document;
  }, [document]);

  useEffect(
    () => () => {
      compilerRef.current?.dispose();
      compilerRef.current = null;
    },
    [createCompiler, assetProvider, tid]
  );

  useEffect(
    () => () => {
      if (pdfUrlRef.current !== null) URL.revokeObjectURL(pdfUrlRef.current);
    },
    []
  );

  const getCompiler = useCallback((): PrintCompiler => {
    if (compilerRef.current === null) {
      const options: TypstPrintCompilerOptions = {
        tid,
        fetchAsset: (url) => assetProvider.fetchAsset(url),
        resolveFile: (scope, filename) =>
          assetProvider.resolveFile(scope, filename),
        onProgress: setProgress,
      };
      compilerRef.current = createCompiler(options);
    }
    return compilerRef.current;
  }, [assetProvider, createCompiler, tid]);

  const replacePdfUrl = useCallback((url: string) => {
    if (pdfUrlRef.current !== null) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = url;
    setPdfUrl(url);
  }, []);

  const compile = useCallback(
    async (downloadAfterCompile = false) => {
      if (support !== 'supported') return;
      const snapshot = documentRef.current;
      autoSignatureRef.current = JSON.stringify(snapshot);
      const runId = ++runIdRef.current;
      setFailure(null);
      setProgress(null);
      setRunning('init');
      try {
        const compiler = getCompiler();
        await compiler.init();
        if (runId === runIdRef.current) setRunning('compile');
        const result = await compiler.compilePdf(snapshot);
        if (runId !== runIdRef.current || result.status === 'stale') return;
        setCompileDiagnostics(result.diagnostics);
        if (result.status === 'ok') {
          const nextUrl = URL.createObjectURL(
            new Blob([result.pdf as BlobPart], { type: 'application/pdf' })
          );
          replacePdfUrl(nextUrl);
          if (downloadAfterCompile) {
            downloadUrl(printPdfFileName(tid, snapshot.title), nextUrl);
          }
        }
      } catch (error) {
        if (runId === runIdRef.current) {
          setFailure(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (runId === runIdRef.current) {
          setRunning(null);
          setProgress(null);
        }
      }
    },
    [getCompiler, replacePdfUrl, support, tid]
  );

  const signature = JSON.stringify(document);
  useEffect(() => {
    if (
      support !== 'supported' ||
      running !== null ||
      autoSignatureRef.current === signature
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      autoSignatureRef.current = signature;
      void compile();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [compile, running, signature, support]);

  const statusText =
    running === 'init'
      ? progress === null
        ? t('preparing')
        : t('downloading', { stage: t(`stage.${progress.stage}`) })
      : running === 'compile'
        ? t('compiling')
        : null;
  const busy = running !== null;

  return (
    <section
      className="flex size-full min-h-0 flex-col bg-muted/30"
      aria-label={t('previewTitle')}
      data-llm-visible="true"
    >
      <div className="flex min-h-12 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <h2 className="mr-auto text-sm font-medium">{t('previewTitle')}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void compile()}
          disabled={busy || support !== 'supported'}
          aria-label={t('refreshPreview')}
          title={t('refreshPreview')}
        >
          {running !== null ? (
            <LoaderCircle className="animate-spin" />
          ) : (
            <RotateCcw />
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void compile(true)}
          disabled={busy || support !== 'supported'}
        >
          <Download />
          {t('download')}
        </Button>
      </div>

      {statusText !== null && (
        <div className="space-y-1 border-b bg-card px-3 py-2" role="status">
          <div className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>{statusText}</span>
            {running === 'init' && progress !== null && (
              <span className="tabular-nums">{progress.percent}%</span>
            )}
          </div>
          <Progress
            value={progress?.percent ?? 0}
            className={cn('h-1', progress === null && 'animate-pulse')}
          />
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        {pdfUrl === null ? (
          <Empty className="size-full">
            <EmptyMedia variant="icon">
              {running === null ? (
                <FileText />
              ) : (
                <LoaderCircle className="animate-spin" />
              )}
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>{t('previewPlaceholderTitle')}</EmptyTitle>
              <EmptyDescription>{t('previewAutoDescription')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="size-full overflow-hidden">
            <ReactPdfViewer key={pdfUrl} src={pdfUrl} />
          </div>
        )}

        {failure !== null && (
          <Alert
            variant="destructive"
            className="absolute top-3 right-3 left-3 z-10 bg-background/95 shadow-md backdrop-blur"
          >
            <CircleAlert />
            <AlertTitle>{t('compileErrorTitle')}</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{failure}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void compile()}
                disabled={busy || support !== 'supported'}
              >
                <RotateCcw />
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {compileDiagnostics.length > 0 && (
        <div className="max-h-48 overflow-auto border-t bg-card p-3">
          <PrintDiagnosticsPanel
            diagnostics={compileDiagnostics}
            problems={document.problems}
          />
        </div>
      )}
    </section>
  );
}
