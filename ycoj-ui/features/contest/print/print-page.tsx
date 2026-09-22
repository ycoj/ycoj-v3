'use client';

import type { CreatePrintCompiler, PrintSupport } from './compiler';
import { createContestAssetProvider } from './contest-asset-provider';
import { getPrintSupport } from './print-assets';
import PrintContestSettings from './print-contest-settings';
import PrintDiagnosticsPanel from './print-diagnostics-panel';
import { draftProblemOrder } from './print-draft';
import PrintPreviewPanel from './print-preview-panel';
import PrintProblemList from './print-problem-list';
import { usePrintDraft } from './use-print-draft';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useSyncExternalStore } from 'react';

type Props = {
  tid: string;
  data: ContestManagementResponse;
  /** Test seam forwarded to `PrintPreviewPanel`. */
  createCompiler?: CreatePrintCompiler;
};

const subscribeNoop = () => () => {};

/**
 * `getPrintSupport()` must run on the client — reading it during SSR would
 * render 'unsupported' markup that mismatches hydration. `null` means the
 * gate has not been evaluated yet (SSR + first client render); the real
 * value arrives with the post-hydration snapshot.
 */
function usePrintSupport(): PrintSupport | null {
  return useSyncExternalStore(subscribeNoop, getPrintSupport, () => null);
}

/**
 * Client root of the printable-PDF editor. The draft lives entirely in
 * `usePrintDraft`; this component only wires the sections together and owns
 * the browser-support gate. SSR-safe: `typst-compiler.ts` is imported for
 * `createTypstPrintCompiler` but has no top-level WASM/worker side effects —
 * the worker module is only referenced inside `defaultCreateWorker` and the
 * `@myriaddreamin/*` packages load lazily inside the worker.
 */
export default function PrintPage({ tid, data, createCompiler }: Props) {
  const t = useTranslations('contestPrint');
  const support = usePrintSupport();
  const { document, diagnostics, overrides, isDirty, actions } =
    usePrintDraft(data);

  /**
   * `file://` resolution + credentialed asset fetches for the compiler:
   * contest scope comes from `tdoc.files`, problem scopes from each
   * `pdoc.additional_file` list (same sources as `resolveFileUrls`).
   */
  const assetProvider = useMemo(
    () =>
      createContestAssetProvider({
        tid,
        contestFiles: data.tdoc.files ?? [],
        problemFiles: Object.fromEntries(
          Object.entries(data.pdict).map(([docId, pdoc]) => [
            docId,
            pdoc.additional_file ?? [],
          ])
        ),
      }),
    [tid, data]
  );

  return (
    <div className="space-y-6" data-llm-visible="true">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold" data-llm-text={t('title')}>
          {t('title')}
        </h1>
        <p
          className="text-muted-foreground text-sm"
          data-llm-text={t('description')}
        >
          {t('description')}
        </p>
      </header>

      {support === 'unsupported' && (
        <Alert>
          <TriangleAlert />
          <AlertTitle data-llm-text={t('unsupportedTitle')}>
            {t('unsupportedTitle')}
          </AlertTitle>
          <AlertDescription data-llm-text={t('unsupportedDescription')}>
            {t('unsupportedDescription')}
          </AlertDescription>
        </Alert>
      )}

      <PrintDiagnosticsPanel
        diagnostics={diagnostics}
        problems={document.problems}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-2">
          <PrintContestSettings
            document={document}
            onPatch={actions.updateContest}
          />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <PrintProblemList
            data={data}
            document={document}
            order={draftProblemOrder(overrides, data)}
            problemOverrides={overrides.problems ?? {}}
            isDirty={isDirty}
            actions={actions}
          />
        </div>
      </div>

      <PrintPreviewPanel
        tid={tid}
        document={document}
        support={support}
        assetProvider={assetProvider}
        createCompiler={createCompiler}
      />
    </div>
  );
}
