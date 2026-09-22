import type { CreatePrintCompiler } from './compiler';
import { createContestAssetProvider } from './contest-asset-provider';
import { createMockPrintCompiler } from './fixtures/mock-print-compiler';
import { twoProblemContest } from './fixtures/two-problem-contest';
import type { PrintableContest } from './model';
import PrintPage from './print-page';
import PrintPreviewPanel from './print-preview-panel';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import messages from '@/messages/en';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const response = twoProblemContest.response;

// pdf.js is heavy and needs worker wiring; the viewer contract (`src` URL in,
// rendered document out) is stubbed exactly like markdown-pdf tests do.
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
  doc: PrintableContest = twoProblemContest.document,
  support: 'supported' | 'unsupported' = 'supported'
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PrintPreviewPanel
        tid="7"
        document={doc}
        support={support}
        assetProvider={assetProvider}
        createCompiler={createCompiler}
      />
    </NextIntlClientProvider>
  );
}

function renderPage(
  createCompiler: CreatePrintCompiler,
  data: ContestManagementResponse = response
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PrintPage tid="7" data={data} createCompiler={createCompiler} />
    </NextIntlClientProvider>
  );
}

const generateButton = () =>
  screen.getByRole('button', { name: 'Generate PDF' });
const downloadButton = () =>
  screen.getByRole('button', { name: 'Download PDF' });
const pdfDocument = () =>
  screen.findByRole('document', { name: 'PDF document' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PrintPreviewPanel', () => {
  it('generates a PDF, previews it, and enables download', async () => {
    const mock = createMockPrintCompiler({ emitProgress: true });
    const user = userEvent.setup();
    renderPanel(mock);

    expect(downloadButton()).toBeDisabled();
    await user.click(generateButton());

    const viewer = await pdfDocument();
    expect(viewer.getAttribute('data-src')).toMatch(/^blob:/);
    expect(downloadButton()).toBeEnabled();
    expect(mock.calls.init).toBe(1);
    expect(mock.calls.compilePdf).toHaveLength(1);
    // The compiler was created lazily with the provider wiring.
    expect(mock.calls.exportTypstSource).toHaveLength(0);
  });

  it('shows staged progress and percent while the compiler boots', async () => {
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
      async exportTypstSource() {
        return new Uint8Array(0);
      },
      dispose() {},
    });
    const user = userEvent.setup();
    renderPanel(createCompiler);

    await user.click(generateButton());
    expect(
      await screen.findByText('Downloading compiler…')
    ).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(generateButton()).toBeDisabled();

    releaseInit();
    await pdfDocument();
    await waitFor(() => {
      expect(
        screen.queryByText('Downloading compiler…')
      ).not.toBeInTheDocument();
    });
  });

  it('shows compile diagnostics and keeps download off', async () => {
    const mock = createMockPrintCompiler({
      compile: {
        status: 'diagnostics',
        diagnostics: [
          {
            severity: 'error',
            code: 'typst-diagnostic',
            message: 'unknown variable: print-math',
            location: { path: '/problem-0.typ', range: '2:5-2:18' },
          },
        ],
      },
    });
    const user = userEvent.setup();
    renderPanel(mock);

    await user.click(generateButton());

    expect(
      await screen.findByText('unknown variable: print-math')
    ).toBeInTheDocument();
    expect(screen.queryByRole('document')).not.toBeInTheDocument();
    expect(downloadButton()).toBeDisabled();
    expect(screen.getByText('No PDF yet')).toBeInTheDocument();
  });

  it('surfaces an init failure and retries with a fresh boot', async () => {
    let attempts = 0;
    const flaky: CreatePrintCompiler = () => ({
      async init() {
        attempts += 1;
        if (attempts === 1) throw new Error('wasm download failed');
      },
      async compilePdf() {
        return { status: 'ok', pdf: new Uint8Array([1]), diagnostics: [] };
      },
      async exportTypstSource() {
        return new Uint8Array(0);
      },
      dispose() {},
    });
    const user = userEvent.setup();
    renderPanel(flaky);

    await user.click(generateButton());
    expect(await screen.findByText('wasm download failed')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'PDF generation failed'
    );

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await pdfDocument();
    expect(attempts).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('leaves the UI untouched when the compile resolves stale', async () => {
    const mock = createMockPrintCompiler({ compile: { status: 'stale' } });
    const user = userEvent.setup();
    renderPanel(mock);

    await user.click(generateButton());
    await waitFor(() => expect(generateButton()).toBeEnabled());

    expect(screen.getByText('No PDF yet')).toBeInTheDocument();
    expect(downloadButton()).toBeDisabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('document')).not.toBeInTheDocument();
  });

  it('revokes the previous object URL on recompile and on unmount', async () => {
    const createdUrls: string[] = [];
    const realCreate = URL.createObjectURL.bind(URL);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (obj: Blob | MediaSource) => {
        const url = realCreate(obj);
        createdUrls.push(url);
        return url;
      }
    );
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');
    const mock = createMockPrintCompiler();
    const user = userEvent.setup();
    const view = renderPanel(mock);

    await user.click(generateButton());
    await pdfDocument();
    expect(createdUrls).toHaveLength(1);

    await user.click(generateButton());
    await waitFor(() => expect(createdUrls).toHaveLength(2));
    expect(revokeSpy).toHaveBeenCalledWith(createdUrls[0]);
    expect(revokeSpy).not.toHaveBeenCalledWith(createdUrls[1]);

    view.unmount();
    expect(revokeSpy).toHaveBeenCalledWith(createdUrls[1]);
    expect(mock.calls.dispose).toBe(1);
  });

  it('downloads the preview URL under the sanitized contest filename', async () => {
    const createdUrls: string[] = [];
    const realCreate = URL.createObjectURL.bind(URL);
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (obj: Blob | MediaSource) => {
        const url = realCreate(obj);
        createdUrls.push(url);
        return url;
      }
    );
    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      anchors.push(this);
    });
    const user = userEvent.setup();
    renderPanel(createMockPrintCompiler());

    await user.click(generateButton());
    await pdfDocument();
    await user.click(downloadButton());

    expect(anchors).toHaveLength(1);
    expect(anchors[0]?.download).toBe('contest-7-ycoj-2026.pdf');
    expect(anchors[0]?.href).toBe(createdUrls[0]);
  });

  it('exports the Typst source zip without booting the worker', async () => {
    const anchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      anchors.push(this);
    });
    const mock = createMockPrintCompiler();
    const user = userEvent.setup();
    renderPanel(mock);

    await user.click(
      screen.getByRole('button', { name: 'Download Typst source' })
    );

    await waitFor(() => expect(mock.calls.exportTypstSource).toHaveLength(1));
    expect(mock.calls.init).toBe(0);
    expect(anchors[0]?.download).toBe('contest-7-typst-source.zip');
  });

  it('disables generate when the browser cannot compile', () => {
    renderPanel(createMockPrintCompiler(), undefined, 'unsupported');
    expect(generateButton()).toBeDisabled();
  });
});

describe('print page compile wiring', () => {
  it('passes the draft-built document with statements intact to compilePdf', async () => {
    const mock = createMockPrintCompiler();
    const user = userEvent.setup();
    renderPage(mock);

    await user.click(generateButton());
    await pdfDocument();

    expect(mock.calls.compilePdf).toHaveLength(1);
    const sent = mock.calls.compilePdf[0];
    expect(sent?.title).toBe('YCOJ 冬季赛 2026');
    expect(sent?.problems).toHaveLength(2);
    // Conversion tests pin the Typst output; here the whole draft→compile
    // path proves the raw statement markdown reaches the compiler untouched.
    const statement = sent?.problems[0]?.statement ?? '';
    expect(statement).toContain('file://range.png');
    expect(statement).toContain('$a$');
    expect(statement).toContain(':::info');
    expect(statement).toContain('```cpp');
    expect(statement).toContain('| 输入');
  });

  it('flags the preview as outdated after the draft changes', async () => {
    const mock = createMockPrintCompiler();
    const user = userEvent.setup();
    renderPage(mock);

    await user.click(generateButton());
    await pdfDocument();
    expect(screen.queryByText('Outdated')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit problem A' }));
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'A+B Problem',
    });
    const card = heading.closest('li');
    expect(card).not.toBeNull();
    const titleInput = within(card!).getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Sum problem');

    expect(await screen.findByText('Outdated')).toBeInTheDocument();
    // The old PDF stays visible and downloadable while stale.
    expect(
      screen.getByRole('document', { name: 'PDF document' })
    ).toBeInTheDocument();
    expect(downloadButton()).toBeEnabled();

    await user.click(generateButton());
    await waitFor(() =>
      expect(screen.queryByText('Outdated')).not.toBeInTheDocument()
    );
    expect(mock.calls.compilePdf).toHaveLength(2);
  });

  it('still generates when the contest has no problems', async () => {
    const mock = createMockPrintCompiler();
    const user = userEvent.setup();
    renderPage(mock, {
      ...response,
      tdoc: { ...response.tdoc, pids: [] },
      pdict: {},
    });

    await user.click(generateButton());
    await pdfDocument();
    expect(mock.calls.compilePdf[0]?.problems).toHaveLength(0);
    expect(downloadButton()).toBeEnabled();
  });
});
