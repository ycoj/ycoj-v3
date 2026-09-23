import type { CreatePrintCompiler } from './compiler';
import { createContestAssetProvider } from './contest-asset-provider';
import { createMockPrintCompiler } from './fixtures/mock-print-compiler';
import { twoProblemContest } from './fixtures/two-problem-contest';
import type { PrintableContest } from './model';
import PrintPreviewPanel from './print-preview-panel';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/dynamic', () => ({
  __esModule: true,
  default: () =>
    function MockReactPdfViewer({ src }: { src: string }) {
      return <div aria-label="PDF document" data-src={src} role="document" />;
    },
}));

const assetProvider = createContestAssetProvider({
  tid: '7',
  contestFiles: [],
  problemFiles: {},
});

function renderPanel(
  createCompiler: CreatePrintCompiler,
  document: PrintableContest = twoProblemContest.document,
  support: 'supported' | 'unsupported' = 'supported'
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PrintPreviewPanel
        tid="7"
        document={document}
        support={support}
        assetProvider={assetProvider}
        createCompiler={createCompiler}
      />
    </NextIntlClientProvider>
  );
}

const pdfDocument = () =>
  screen.findByRole('document', { name: 'PDF document' });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PrintPreviewPanel', () => {
  it('automatically compiles and previews the initial draft', async () => {
    const mock = createMockPrintCompiler({ emitProgress: true });
    renderPanel(mock);

    const viewer = await pdfDocument();
    expect(viewer.getAttribute('data-src')).toMatch(/^blob:/);
    expect(mock.calls.init).toBe(1);
    expect(mock.calls.compilePdf).toHaveLength(1);
    expect(
      screen.queryByRole('button', { name: /Typst source/i })
    ).not.toBeInTheDocument();
  });

  it('shows staged progress while the compiler boots', async () => {
    let releaseInit = () => {};
    const createCompiler: CreatePrintCompiler = (options) => ({
      init() {
        options.onProgress?.({
          stage: 'wasm',
          loaded: 50,
          total: 100,
          percent: 50,
        });
        return new Promise<void>((resolve) => {
          releaseInit = resolve;
        });
      },
      async compilePdf() {
        return {
          status: 'ok',
          pdf: new Uint8Array([1, 2, 3]),
          diagnostics: [],
        };
      },
      dispose() {},
    });
    renderPanel(createCompiler);

    expect(
      await screen.findByText('Downloading compiler…')
    ).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();

    releaseInit();
    await pdfDocument();
  });

  it('keeps the previous preview visible when a recompile fails', async () => {
    let attempts = 0;
    const createCompiler: CreatePrintCompiler = () => ({
      async init() {},
      async compilePdf() {
        attempts += 1;
        if (attempts === 1) {
          return { status: 'ok', pdf: new Uint8Array([1]), diagnostics: [] };
        }
        throw new Error('compile failed');
      },
      dispose() {},
    });
    const view = renderPanel(createCompiler);
    await pdfDocument();

    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PrintPreviewPanel
          tid="7"
          document={{ ...twoProblemContest.document, title: 'Changed' }}
          support="supported"
          assetProvider={assetProvider}
          createCompiler={createCompiler}
        />
      </NextIntlClientProvider>
    );

    expect(await screen.findByText('compile failed')).toBeInTheDocument();
    expect(
      screen.getByRole('document', { name: 'PDF document' })
    ).toBeInTheDocument();
  });

  it('compiles the latest draft after an in-flight initial compile finishes', async () => {
    type CompileResult = Awaited<
      ReturnType<ReturnType<CreatePrintCompiler>['compilePdf']>
    >;
    let releaseInitialCompile: (result: CompileResult) => void = () => {};
    const compilePdf = vi.fn((document: PrintableContest) =>
      document.title === twoProblemContest.document.title
        ? new Promise<CompileResult>((resolve) => {
            releaseInitialCompile = resolve;
          })
        : Promise.resolve({
            status: 'ok' as const,
            pdf: new Uint8Array([2]),
            diagnostics: [],
          })
    );
    const createCompiler: CreatePrintCompiler = () => ({
      async init() {},
      compilePdf,
      dispose() {},
    });
    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:initial')
      .mockReturnValueOnce('blob:latest');
    const view = renderPanel(createCompiler);

    await waitFor(() => expect(compilePdf).toHaveBeenCalledTimes(1));
    const latestDocument = {
      ...twoProblemContest.document,
      title: 'Latest contest title',
    };
    view.rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <PrintPreviewPanel
          tid="7"
          document={latestDocument}
          support="supported"
          assetProvider={assetProvider}
          createCompiler={createCompiler}
        />
      </NextIntlClientProvider>
    );

    releaseInitialCompile({
      status: 'ok',
      pdf: new Uint8Array([1]),
      diagnostics: [],
    });

    await waitFor(() => expect(compilePdf).toHaveBeenCalledTimes(2));
    expect(compilePdf.mock.calls[1]?.[0]).toBe(latestDocument);
    await waitFor(() =>
      expect(
        screen.getByRole('document', { name: 'PDF document' })
      ).toHaveAttribute('data-src', 'blob:latest')
    );
  });

  it('downloads a newly compiled current draft', async () => {
    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      anchors.push(this);
    });
    const mock = createMockPrintCompiler();
    const user = userEvent.setup();
    renderPanel(mock);
    await pdfDocument();

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(anchors).toHaveLength(1));
    expect(mock.calls.compilePdf).toHaveLength(2);
    expect(anchors[0]?.download).toBe('contest-7-ycoj-2026.pdf');
  });

  it('disables compile actions when the browser is unsupported', () => {
    renderPanel(createMockPrintCompiler(), undefined, 'unsupported');
    expect(
      screen.getByRole('button', { name: 'Refresh preview' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  });
});
