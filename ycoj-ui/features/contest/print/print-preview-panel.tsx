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
import {
  downloadBlob,
  downloadUrl,
  printPdfFileName,
  printSourceFileName,
} from './print-download';
import {
  createTypstPrintCompiler,
  type TypstPrintCompilerOptions,
} from './typst-compiler';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
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
  FileCode,
  FileText,
  LoaderCircle,
  Printer,
  RotateCcw,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useRef, useState } from 'react';

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

/**
 * pdf.js only runs in the browser — lazy-load the shared viewer exactly like
 * `markdown-pdf.tsx`/`file-preview-dialog.tsx` do, so the print page bundle
 * stays free of pdfjs until a PDF exists.
 */
const ReactPdfViewer = dynamic(
  () => import('@/shared/components/markdown/components/react-pdf-viewer'),
  { loading: PdfPreviewLoading, ssr: false }
);

type Props = {
  /** Contest docId — scopes `file://` asset resolution for the compiler. */
  tid: string;
  /** Memoized `buildPrintableContest` output; compile it as-is. */
  document: PrintableContest;
  /** `getPrintSupport()` result; `null` before mount (SSR-safe unknown). */
  support: PrintSupport | null;
  /** Resolves `file://` names and fetches document asset bytes. */
  assetProvider: PrintAssetProvider;
  /** Test seam: defaults to the real Typst/WASM backend. */
  createCompiler?: CreatePrintCompiler;
};

/** What the Generate action is currently doing, if anything. */
type RunningPhase = 'init' | 'compile';

/**
 * Compile + preview panel: owns the `PrintCompiler` instance, the staged
 * init progress, the resulting PDF object URL (preview + download), the
 * compile diagnostics list, and the outdated-draft badge. The compiler is
 * created lazily on the first Generate and disposed on unmount.
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
  /** Live object URL for the current PDF; mirrored into state for render. */
  const pdfUrlRef = useRef<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [running, setRunning] = useState<RunningPhase | null>(null);
  const [progress, setProgress] = useState<PrintCompilerProgress | null>(null);
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [compileDiagnostics, setCompileDiagnostics] = useState<
    PrintDiagnostic[]
  >([]);
  const [compiledSignature, setCompiledSignature] = useState<string | null>(
    null
  );

  /**
   * Cheap change detector: the draft builder is deterministic, so the JSON
   * serialization of the document identifies exactly what was compiled.
   */
  const signature = useMemo(() => JSON.stringify(document), [document]);
  const outdated = pdfUrl !== null && compiledSignature !== signature;
  const busy = running !== null || exporting;

  // Tear down the worker when the panel unmounts or the compiler inputs
  // change; clearing the ref lets StrictMode remounts lazily recreate it.
  useEffect(
    () => () => {
      compilerRef.current?.dispose();
      compilerRef.current = null;
    },
    [createCompiler, assetProvider, tid]
  );

  // Revoke the live preview URL when the panel goes away.
  useEffect(
    () => () => {
      if (pdfUrlRef.current !== null) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = null;
      }
    },
    []
  );

  const getCompiler = (): PrintCompiler => {
    if (compilerRef.current === null) {
      const options: TypstPrintCompilerOptions = {
        tid,
        // Wrapped calls keep working if a provider later becomes class-based.
        fetchAsset: (url) => assetProvider.fetchAsset(url),
        resolveFile: (scope, filename) =>
          assetProvider.resolveFile(scope, filename),
        onProgress: (event) => setProgress(event),
      };
      compilerRef.current = createCompiler(options);
    }
    return compilerRef.current;
  };

  /** Swap the previewed PDF; the previous object URL is revoked. */
  const replacePdfUrl = (url: string | null) => {
    if (pdfUrlRef.current !== null) {
      URL.revokeObjectURL(pdfUrlRef.current);
    }
    pdfUrlRef.current = url;
    setPdfUrl(url);
  };

  const generate = async () => {
    if (busy || support !== 'supported') return;
    const snapshot = document;
    const snapshotSignature = signature;
    setFailure(null);
    setCompileDiagnostics([]);
    setProgress(null);
    setRunning('init');
    try {
      const compiler = getCompiler();
      // init() is idempotent: the first call boots the worker with staged
      // download progress, later calls reuse the warm session.
      await compiler.init();
      setRunning('compile');
      const result = await compiler.compilePdf(snapshot);
      // A newer compile owns the UI; this panel never starts concurrent
      // compiles, so a stale result simply leaves the current state alone.
      if (result.status === 'stale') return;
      setCompileDiagnostics(result.diagnostics);
      if (result.status === 'ok') {
        replacePdfUrl(
          URL.createObjectURL(
            new Blob([result.pdf as BlobPart], { type: 'application/pdf' })
          )
        );
        setCompiledSignature(snapshotSignature);
      }
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(null);
      setProgress(null);
    }
  };

  const downloadPdf = () => {
    if (pdfUrl === null) return;
    // Reuses the live preview object URL — it must NOT be revoked here; the
    // lifecycle is owned by replacePdfUrl + the unmount cleanup.
    downloadUrl(printPdfFileName(tid, document.title), pdfUrl);
  };

  const exportTypst = async () => {
    if (busy) return;
    setFailure(null);
    setExporting(true);
    try {
      // No worker boot needed — the adapter builds the shadow FS and zips it
      // on the main thread.
      const zip = await getCompiler().exportTypstSource(document);
      downloadBlob(
        printSourceFileName(tid),
        new Blob([zip as BlobPart], { type: 'application/zip' })
      );
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  };

  const statusText =
    running === 'init'
      ? progress === null
        ? t('preparing')
        : t('downloading', { stage: t(`stage.${progress.stage}`) })
      : running === 'compile'
        ? t('compiling')
        : null;

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle data-llm-text={t('previewTitle')}>
          {t('previewTitle')}
        </CardTitle>
        <CardDescription data-llm-text={t('previewDescription')}>
          {t('previewDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void generate()}
            disabled={busy || support !== 'supported'}
            aria-label={t('generate')}
          >
            {running !== null ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Printer />
            )}
            {t('generate')}
          </Button>
          <Button
            variant="outline"
            onClick={downloadPdf}
            disabled={pdfUrl === null}
            aria-label={t('download')}
          >
            <Download />
            {t('download')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportTypst()}
            disabled={busy}
            aria-label={t('downloadTypstSource')}
          >
            {exporting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <FileCode />
            )}
            {t('downloadTypstSource')}
          </Button>
          {outdated && (
            <>
              <Badge variant="secondary" data-llm-text={t('outdatedBadge')}>
                {t('outdatedBadge')}
              </Badge>
              <span
                className="text-muted-foreground text-xs"
                data-llm-text={t('outdatedHint')}
              >
                {t('outdatedHint')}
              </span>
            </>
          )}
        </div>

        {statusText !== null && (
          <div
            className="space-y-1.5"
            role="status"
            aria-live="polite"
            data-llm-visible="true"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-muted-foreground text-sm"
                data-llm-text={statusText}
              >
                {statusText}
              </span>
              {running === 'init' && progress !== null && (
                <span className="text-muted-foreground text-sm tabular-nums">
                  {progress.percent}%
                </span>
              )}
            </div>
            <Progress
              value={progress?.percent ?? 0}
              className={cn('h-1.5', progress === null && 'animate-pulse')}
            />
          </div>
        )}

        {failure !== null && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle data-llm-text={t('compileErrorTitle')}>
              {t('compileErrorTitle')}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p data-llm-text={failure}>{failure}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void generate()}
                disabled={busy || support !== 'supported'}
              >
                <RotateCcw />
                {t('retry')}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <PrintDiagnosticsPanel
          diagnostics={compileDiagnostics}
          problems={document.problems}
        />

        {pdfUrl === null ? (
          <Empty className="border">
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle data-llm-text={t('previewPlaceholderTitle')}>
                {t('previewPlaceholderTitle')}
              </EmptyTitle>
              <EmptyDescription
                data-llm-text={t('previewPlaceholderDescription')}
              >
                {t('previewPlaceholderDescription')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="h-[clamp(28rem,85vh,72rem)] overflow-hidden rounded-md border">
            <ReactPdfViewer key={pdfUrl} src={pdfUrl} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
