import type { PrintAssetScope } from './assets';
import type { PrintCompilerProgress, PrintCompiler } from './compiler';
import { twoProblemContest } from './fixtures/two-problem-contest';
import type { PrintableContest } from './model';
import { getPrintSupport } from './print-assets';
import {
  createTypstPrintCompiler,
  type TypstPrintCompilerInternals,
} from './typst-compiler';
import type {
  TypstWorkerDiagnostic,
  TypstWorkerRequest,
  TypstWorkerResponse,
} from './typst-protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Scripted stand-in for `typst.worker.ts`. Records every posted request and
 * responds on `queueMicrotask` so the adapter's async plumbing is exercised
 * without real WASM.
 */
class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<TypstWorkerResponse>) => void) | null = null;
  onerror: ((event: Event | string) => void) | null = null;
  onmessageerror: ((event: Event | string) => void) | null = null;
  readonly messages: TypstWorkerRequest[] = [];
  /** Transfer list paired with each posted message, by index. */
  readonly transfers: Array<Transferable[] | undefined> = [];
  terminated = false;
  autoInit = true;
  autoCompile = true;
  pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
  diagnostics: TypstWorkerDiagnostic[] = [];

  constructor() {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown, transfer?: Transferable[]): void {
    const request = message as TypstWorkerRequest;
    this.messages.push(request);
    this.transfers.push(transfer);
    if (request.kind === 'init' && this.autoInit) {
      queueMicrotask(() => this.emit({ kind: 'ready' }));
    }
    if (request.kind === 'compile' && this.autoCompile) {
      const { id } = request;
      queueMicrotask(() =>
        this.emit({
          kind: 'compiled',
          id,
          pdf: this.pdf,
          diagnostics: this.diagnostics,
        })
      );
    }
  }

  emit(response: TypstWorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<TypstWorkerResponse>);
  }

  compileMessages(): Array<Extract<TypstWorkerRequest, { kind: 'compile' }>> {
    return this.messages.filter(
      (message): message is Extract<TypstWorkerRequest, { kind: 'compile' }> =>
        message.kind === 'compile'
    );
  }

  terminate(): void {
    this.terminated = true;
  }
}

function fakeResponse(bytes: number, chunk = 0): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let remaining = bytes;
      while (remaining > 0) {
        const size = chunk > 0 ? Math.min(chunk, remaining) : remaining;
        controller.enqueue(new Uint8Array(size));
        remaining -= size;
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'content-length': String(bytes) },
  });
}

type Harness = {
  compiler: PrintCompiler;
  worker: () => FakeWorker;
  fetchStatic: ReturnType<typeof vi.fn<(url: string) => Promise<Response>>>;
  fetchAsset: ReturnType<typeof vi.fn<(url: string) => Promise<Uint8Array>>>;
  resolveFile: ReturnType<
    typeof vi.fn<(scope: PrintAssetScope, filename: string) => string | null>
  >;
  progress: PrintCompilerProgress[];
};

function makeHarness(
  internals: Partial<TypstPrintCompilerInternals> = {}
): Harness {
  const fetchStatic = vi.fn<(url: string) => Promise<Response>>(async () =>
    fakeResponse(64, 16)
  );
  const fetchAsset = vi.fn<(url: string) => Promise<Uint8Array>>(
    async () => new Uint8Array([1, 2, 3, 4])
  );
  const resolveFile = vi.fn<
    (scope: PrintAssetScope, filename: string) => string | null
  >(() => null);
  const progress: PrintCompilerProgress[] = [];
  const compiler = createTypstPrintCompiler(
    {
      fetchAsset,
      onProgress: (event) => progress.push({ ...event }),
      resolveFile,
      tid: '7',
    },
    {
      createWorker: () => new FakeWorker() as unknown as Worker,
      fetchStatic: fetchStatic as unknown as typeof fetch,
      assetBase: 'https://cdn.example.com/print',
      ...internals,
    }
  );
  return {
    compiler,
    worker: () => FakeWorker.instances[FakeWorker.instances.length - 1],
    fetchStatic,
    fetchAsset,
    resolveFile,
    progress,
  };
}

const document = twoProblemContest.document;

beforeEach(() => {
  FakeWorker.instances = [];
});

describe('createTypstPrintCompiler', () => {
  it('reports getPrintSupport as unsupported in node', () => {
    expect(getPrintSupport()).toBe('unsupported');
  });

  it('boots once for concurrent init calls and reports stage progress', async () => {
    const harness = makeHarness();
    await Promise.all([harness.compiler.init(), harness.compiler.init()]);
    expect(FakeWorker.instances).toHaveLength(1);
    const initMessages = harness
      .worker()
      .messages.filter((message) => message.kind === 'init');
    expect(initMessages).toHaveLength(1);
    // One wasm entry, all bundled fonts, and the vendored mitex tarball.
    const urls = harness.fetchStatic.mock.calls.map((call) => String(call[0]));
    expect(
      urls.filter((url) => url.endsWith('typst_ts_web_compiler_bg.wasm'))
    ).toHaveLength(1);
    expect(urls.filter((url) => url.includes('/fonts/typst/')).length).toBe(18);
    expect(urls.some((url) => url.endsWith('mitex-0.2.7.tarball'))).toBe(true);
    expect(urls.every((url) => url.startsWith('https://cdn.example.com'))).toBe(
      true
    );
    for (const stage of ['wasm', 'fonts', 'packages']) {
      expect(harness.progress.map((event) => event.stage)).toContain(stage);
      const last = [...harness.progress]
        .reverse()
        .find((event) => event.stage === stage);
      expect(last?.percent).toBe(100);
    }
  });

  it('retries with a fresh worker after a download failure', async () => {
    const fetchStatic = vi
      .fn<(url: string) => Promise<Response>>()
      .mockRejectedValueOnce(new Error('network down'))
      .mockImplementation(async () => fakeResponse(64));
    const harness = makeHarness({
      fetchStatic: fetchStatic as unknown as typeof fetch,
    });
    await expect(harness.compiler.init()).rejects.toThrow('network down');
    const first = harness.worker();
    expect(first.terminated).toBe(true);

    await harness.compiler.init();
    expect(FakeWorker.instances).toHaveLength(2);
    const second = harness.worker();
    expect(second).not.toBe(first);
    expect(second.messages.some((m) => m.kind === 'init')).toBe(true);
  });

  it('retries with a fresh worker when the worker reports init failure', async () => {
    const harness = makeHarness();
    const booted = harness.compiler.init();
    const worker = harness.worker();
    worker.autoInit = false;
    worker.emit({ kind: 'failed', message: 'wasm exploded' });
    await expect(booted).rejects.toThrow('wasm exploded');
    expect(worker.terminated).toBe(true);

    await harness.compiler.init();
    expect(FakeWorker.instances).toHaveLength(2);
    expect(harness.worker().terminated).toBe(false);
  });

  it('compiles and returns an ok result with the generated file set', async () => {
    const harness = makeHarness();
    harness.resolveFile.mockImplementation(() => '/img.png');
    const result = await harness.compiler.compilePdf(document);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect([...result.pdf]).toEqual([0x25, 0x50, 0x44, 0x46]);
      expect(result.diagnostics).toEqual([]);
    }
    const compiles = harness.worker().compileMessages();
    expect(compiles).toHaveLength(1);
    expect(compiles[0]?.mainPath).toBe('/main.typ');
    const paths = (compiles[0]?.files ?? []).map((file) => file.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/main.typ',
        '/preamble.typ',
        '/problem-0.typ',
        '/problem-1.typ',
        '/notice.typ',
        '/content.json',
      ])
    );
  });

  it('resolves stale for superseded compiles (latest-wins)', async () => {
    const harness = makeHarness();
    await harness.compiler.init();
    harness.worker().autoCompile = false;
    const first = harness.compiler.compilePdf(document);
    const second = harness.compiler.compilePdf(document);
    // Only the latest request is posted; the earlier one resolves stale.
    await vi.waitFor(() => {
      expect(harness.worker().compileMessages()).toHaveLength(1);
    });
    const worker = harness.worker();
    const request = worker.compileMessages()[0];
    worker.emit({
      kind: 'compiled',
      id: request?.id ?? -1,
      pdf: new Uint8Array([2]),
      diagnostics: [],
    });
    await expect(first).resolves.toEqual({ status: 'stale' });
    const secondResult = await second;
    expect(secondResult.status).toBe('ok');
  });

  it('dedupes the compile transfer list when assets share one ArrayBuffer', async () => {
    const shared = new ArrayBuffer(8);
    const harness = makeHarness();
    harness.resolveFile.mockImplementation(() => '/img.png');
    // Two asset refs fetch distinct views over the SAME buffer; Chromium
    // throws DataCloneError if a buffer appears twice in the transfer list.
    harness.fetchAsset.mockImplementation(async () => new Uint8Array(shared));
    const result = await harness.compiler.compilePdf(document);
    expect(result.status).toBe('ok');
    const worker = harness.worker();
    const compileIndex = worker.messages.findIndex(
      (message) => message.kind === 'compile'
    );
    const transfer = worker.transfers[compileIndex] ?? [];
    expect(transfer).toHaveLength(1);
    expect(transfer[0]).toBe(shared);
  });

  it('re-gzips a raw-tar package download before posting init', async () => {
    // Simulate a CDN attaching `Content-Encoding: gzip` to the tarball URL:
    // the fetch resolves to raw tar bytes instead of gzip.
    const rawTar = new Uint8Array(1024);
    rawTar.set(new TextEncoder().encode('ustar'), 257);
    const fetchStatic = vi.fn(async (url: string) =>
      url.includes('/typst/packages/')
        ? new Response(rawTar.slice(), { status: 200 })
        : fakeResponse(64)
    );
    const harness = makeHarness({
      fetchStatic: fetchStatic as unknown as typeof fetch,
    });
    await harness.compiler.init();
    const init = harness
      .worker()
      .messages.find((message) => message.kind === 'init');
    expect(init?.kind).toBe('init');
    if (init?.kind !== 'init') return;
    const tarball = new Uint8Array(
      init.packages[0]?.tarball ?? new ArrayBuffer(0)
    );
    expect(tarball[0]).toBe(0x1f);
    expect(tarball[1]).toBe(0x8b);
    const restored = new Uint8Array(
      await new Response(
        new Blob([tarball as BlobPart])
          .stream()
          .pipeThrough(new DecompressionStream('gzip'))
      ).arrayBuffer()
    );
    expect(restored).toEqual(rawTar);
  });

  it('resolves stale for every superseded compile', async () => {
    const harness = makeHarness();
    await harness.compiler.init();
    harness.worker().autoCompile = false;
    const first = harness.compiler.compilePdf(document);
    const second = harness.compiler.compilePdf(document);
    const third = harness.compiler.compilePdf(document);
    await vi.waitFor(() => {
      expect(harness.worker().compileMessages()).toHaveLength(1);
    });
    const worker = harness.worker();
    worker.emit({
      kind: 'compiled',
      id: worker.compileMessages()[0]?.id ?? -1,
      pdf: new Uint8Array([9]),
      diagnostics: [],
    });
    const results = await Promise.all([first, second, third]);
    expect(results[0].status).toBe('stale');
    expect(results[1].status).toBe('stale');
    expect(results[2].status).toBe('ok');
  });

  it('wires resolved asset URLs through fetchAsset into compile files', async () => {
    const harness = makeHarness();
    harness.resolveFile.mockImplementation((scope, filename) =>
      scope.kind === 'problem'
        ? `/api/p/${scope.problemId}/file/${filename}?tid=7`
        : `/api/contest/7/file/public/${filename}`
    );
    const result = await harness.compiler.compilePdf(document);
    expect(result.status).toBe('ok');
    const urls = harness.fetchAsset.mock.calls.map((call) => String(call[0]));
    expect(urls).toEqual(
      expect.arrayContaining([
        '/api/p/1001/file/range.png?tid=7',
        '/api/contest/7/file/public/poster.png',
      ])
    );
    const files = harness.worker().compileMessages()[0]?.files ?? [];
    const assetPaths = files
      .map((file) => file.path)
      .filter((path) => path.startsWith('/asset-'));
    // range.png (problem scope) + poster.png (contest scope)
    expect(assetPaths).toHaveLength(2);
  });

  it('continues compiling with decodable placeholders when images fail', async () => {
    const harness = makeHarness();
    harness.resolveFile.mockImplementation(() => '/missing.png');
    harness.fetchAsset.mockRejectedValue(new Error('404'));
    const result = await harness.compiler.compilePdf(document);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(
        result.diagnostics.filter((d) => d.code === 'asset-fetch-failed')
      ).toHaveLength(2);
      expect(
        result.diagnostics
          .filter((d) => d.code === 'asset-fetch-failed')
          .every((d) => d.severity === 'warning')
      ).toBe(true);
    }
    const files = harness.worker().compileMessages()[0]?.files ?? [];
    expect(
      files.filter(
        (file) =>
          file.path.startsWith('/asset-') && file.bytes instanceof Uint8Array
      )
    ).toHaveLength(2);
  });

  it('maps Typst diagnostics into PrintDiagnostics', async () => {
    const harness = makeHarness();
    harness.resolveFile.mockImplementation(() => '/img.png');
    await harness.compiler.init();
    harness.worker().diagnostics = [
      {
        package: '',
        path: '/problem-0.typ',
        severity: 'error',
        range: '2:5-2:18',
        message: 'unknown variable: print-math',
      },
      {
        package: '@preview/mitex:0.2.7',
        path: '/main.typ',
        severity: 'warning',
        range: '',
        message: 'layout did not converge',
      },
    ];
    const result = await harness.compiler.compilePdf(document);
    expect(result.status).toBe('diagnostics');
    if (result.status !== 'diagnostics') return;
    expect(result.diagnostics).toEqual([
      {
        severity: 'error',
        code: 'typst-diagnostic',
        message: 'unknown variable: print-math',
        location: { path: '/problem-0.typ', range: '2:5-2:18' },
      },
      {
        severity: 'warning',
        code: 'typst-diagnostic',
        message: '@preview/mitex:0.2.7: layout did not converge',
        location: { path: '/main.typ', range: undefined },
      },
    ]);
  });

  it('compiles an empty contest document', async () => {
    const harness = makeHarness();
    const empty: PrintableContest = {
      language: 'zh',
      title: '空竞赛',
      subtitle: '',
      dayName: '',
      dateText: '2026-02-07',
      beginAt: '',
      endAt: '',
      notice: '',
      noiStyle: true,
      fileIo: true,
      usePretest: true,
      languages: [],
      problems: [],
      extraSections: [],
    };
    const result = await harness.compiler.compilePdf(empty);
    expect(result.status).toBe('ok');
    const files = harness.worker().compileMessages()[0]?.files ?? [];
    expect(files.map((file) => file.path)).toEqual([
      '/main.typ',
      '/preamble.typ',
      '/tuackCodeTheme.tmTheme',
      '/content.json',
    ]);
  });

  it('rejects in-flight and future calls after dispose', async () => {
    const harness = makeHarness();
    await harness.compiler.init();
    harness.worker().autoCompile = false;
    const stuck = harness.compiler.compilePdf(document);
    await vi.waitFor(() => {
      expect(harness.worker().compileMessages()).toHaveLength(1);
    });
    harness.compiler.dispose();
    expect(harness.worker().terminated).toBe(true);
    await expect(stuck).rejects.toThrow('disposed');
    await expect(harness.compiler.compilePdf(document)).rejects.toThrow(
      'disposed'
    );
  });
});
