import type { PrintAssetScope } from './assets';
import type {
  PrintCompileResult,
  PrintCompiler,
  PrintCompilerOptions,
  PrintCompilerProgress,
  PrintCompilerStage,
} from './compiler';
import type { PrintDiagnostic, PrintableContest } from './model';
import {
  PRINT_COMPILER_WASM_PATH,
  PRINT_FONT_FILES,
  PRINT_PACKAGE_ASSETS,
  getPrintAssetBase,
} from './print-assets';
import { buildTypstFiles } from './print-source';
import type {
  TypstPackageInput,
  TypstWorkerDiagnostic,
  TypstWorkerFile,
  TypstWorkerResponse,
} from './typst-protocol';
import { ensureGzippedTarball } from './vendored-package-registry';

/**
 * `PrintCompilerOptions` plus document-scoped `file://` resolution. `tid` is
 * stamped into `PrintAssetScope`s for providers that read `scope.tid`.
 */
export type TypstPrintCompilerOptions = PrintCompilerOptions & {
  tid?: string;
  resolveFile?: (scope: PrintAssetScope, filename: string) => string | null;
};

/**
 * Test seam: inject a fake worker factory / static fetcher / asset base so
 * unit tests never touch real WASM or the network.
 */
export type TypstPrintCompilerInternals = {
  createWorker?: () => Worker;
  fetchStatic?: typeof fetch;
  assetBase?: string;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function mapTypstDiagnostic(
  diagnostic: TypstWorkerDiagnostic
): PrintDiagnostic {
  return {
    severity:
      diagnostic.severity === 'error'
        ? 'error'
        : diagnostic.severity === 'warning'
          ? 'warning'
          : 'info',
    code: 'typst-diagnostic',
    message:
      diagnostic.package.length > 0
        ? `${diagnostic.package}: ${diagnostic.message}`
        : diagnostic.message,
    location: {
      path: diagnostic.path.length > 0 ? diagnostic.path : undefined,
      range: diagnostic.range.length > 0 ? diagnostic.range : undefined,
    },
  };
}

type StaticFile = { key: string; url: string };
type CompiledResponse = Extract<TypstWorkerResponse, { kind: 'compiled' }>;
type Rejector = { reject: (error: Error) => void };

function defaultCreateWorker(): Worker {
  return new Worker(new URL('./typst.worker.ts', import.meta.url), {
    type: 'module',
    name: 'ycoj-print-typst',
  });
}

/**
 * Download one stage's files concurrently, reporting byte progress. `total`
 * stays undefined until every response header yielded a length; percent is 0
 * while unknown and 100 once the stage finishes.
 */
async function fetchStage(
  stage: PrintCompilerStage,
  files: readonly StaticFile[],
  fetchStatic: typeof fetch,
  report: (progress: PrintCompilerProgress) => void
): Promise<Map<string, ArrayBuffer>> {
  const totals = new Map<string, number>();
  const loaded = new Map<string, number>();
  const emit = () => {
    const loadedSum = [...loaded.values()].reduce((a, b) => a + b, 0);
    const total =
      totals.size === files.length
        ? [...totals.values()].reduce((a, b) => a + b, 0)
        : undefined;
    report({
      stage,
      loaded: loadedSum,
      total,
      percent:
        total !== undefined && total > 0
          ? Math.min(100, Math.floor((loadedSum / total) * 100))
          : 0,
    });
  };
  const results = await Promise.all(
    files.map(async ({ key, url }) => {
      const response = await fetchStatic(url);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch print asset ${url}: HTTP ${response.status}`
        );
      }
      const length = Number(response.headers.get('content-length') ?? '');
      if (Number.isFinite(length) && length > 0) totals.set(key, length);
      let bytes: ArrayBuffer;
      if (response.body !== null) {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.byteLength;
          loaded.set(key, received);
          emit();
        }
        const merged = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          merged.set(chunk, offset);
          offset += chunk.byteLength;
        }
        bytes = merged.buffer;
      } else {
        bytes = await response.arrayBuffer();
      }
      loaded.set(key, bytes.byteLength);
      emit();
      return [key, bytes] as const;
    })
  );
  const totalLoaded = [...loaded.values()].reduce((a, b) => a + b, 0);
  report({ stage, loaded: totalLoaded, total: totalLoaded, percent: 100 });
  return new Map(results);
}

/**
 * Typst/WASM `PrintCompiler`. Spawns `typst.worker.ts`, downloads the
 * compiler wasm, the bundled font set and vendored packages with progress,
 * then streams document compiles through a message protocol. Latest-wins: a
 * newer `compilePdf` makes an in-flight one resolve `{ status: 'stale' }`.
 */
export function createTypstPrintCompiler(
  options: TypstPrintCompilerOptions,
  internals: TypstPrintCompilerInternals = {}
): PrintCompiler {
  const report = options.onProgress ?? (() => undefined);
  const fetchStatic = internals.fetchStatic ?? fetch;
  const createWorker = internals.createWorker ?? defaultCreateWorker;
  const assetBase = internals.assetBase ?? getPrintAssetBase();

  let worker: Worker | null = null;
  let bootPromise: Promise<void> | null = null;
  /** Why the current boot attempt's worker was torn down, if it was. */
  let workerFailure: Error | null = null;
  let disposed = false;
  let nextRequestId = 0;
  let latestCompileSeq = 0;
  const pending = new Map<
    number,
    { resolve: (response: CompiledResponse) => void } & Rejector
  >();
  let initWaiter: ({ resolve: () => void } & Rejector) | null = null;

  const stages: Array<{ stage: PrintCompilerStage; files: StaticFile[] }> = [
    {
      stage: 'wasm',
      files: [
        { key: 'compiler', url: `${assetBase}${PRINT_COMPILER_WASM_PATH}` },
      ],
    },
    {
      stage: 'fonts',
      files: PRINT_FONT_FILES.map((name) => ({
        key: name,
        url: `${assetBase}/fonts/typst/${name}`,
      })),
    },
    {
      stage: 'packages',
      files: PRINT_PACKAGE_ASSETS.map((asset) => ({
        key: asset.file,
        url: `${assetBase}/typst/packages/${asset.file}`,
      })),
    },
  ];

  /** Reject every in-flight call, drop the worker and reset for retry. */
  function teardown(error: Error): void {
    const stale = worker;
    worker = null;
    bootPromise = null;
    workerFailure ??= error;
    initWaiter?.reject(error);
    initWaiter = null;
    for (const call of pending.values()) call.reject(error);
    pending.clear();
    stale?.terminate();
  }

  function handleMessage(event: MessageEvent<TypstWorkerResponse>): void {
    const message = event.data;
    switch (message.kind) {
      case 'ready': {
        initWaiter?.resolve();
        initWaiter = null;
        return;
      }
      case 'compiled': {
        const call = pending.get(message.id);
        pending.delete(message.id);
        call?.resolve(message);
        return;
      }
      case 'failed': {
        const error = new Error(message.message);
        if (message.id === undefined) {
          // init failed: drop everything so the next init() retries fresh.
          teardown(error);
        } else {
          const call = pending.get(message.id);
          pending.delete(message.id);
          call?.reject(error);
        }
        return;
      }
    }
  }

  function handleWorkerError(event: Event | string): void {
    const detail = typeof event === 'string' ? event : event.type;
    teardown(new Error(`Typst worker failed (${detail})`));
  }

  async function boot(): Promise<void> {
    const spawned = createWorker();
    worker = spawned;
    workerFailure = null;
    spawned.onmessage = handleMessage;
    spawned.onerror = handleWorkerError;
    spawned.onmessageerror = handleWorkerError;
    try {
      const assets = new Map<string, ArrayBuffer>();
      for (const { stage, files } of stages) {
        const stageFiles = await fetchStage(stage, files, fetchStatic, report);
        for (const [key, bytes] of stageFiles) {
          assets.set(`${stage}:${key}`, bytes);
        }
      }
      // The worker may have failed (or the compiler been disposed) while
      // assets were downloading; surface that failure instead of posting
      // init to a dead worker.
      if (worker !== spawned) {
        throw (
          workerFailure ?? new Error('Typst worker terminated while booting')
        );
      }
      const requireAsset = (key: string): ArrayBuffer => {
        const bytes = assets.get(key);
        if (bytes === undefined) {
          throw new Error(`Print asset ${key} missing after download`);
        }
        return bytes;
      };
      const payload = {
        kind: 'init' as const,
        compilerWasm: requireAsset('wasm:compiler'),
        fonts: PRINT_FONT_FILES.map((name) => ({
          name,
          data: requireAsset(`fonts:${name}`),
        })),
        packages: await Promise.all(
          PRINT_PACKAGE_ASSETS.map(
            async (asset): Promise<TypstPackageInput> => ({
              ...asset.spec,
              // Servers/CDN may decompress *.tar.gz responses via
              // Content-Encoding — re-gzip raw tar before the worker untars.
              tarball: (
                await ensureGzippedTarball(
                  new Uint8Array(requireAsset(`packages:${asset.file}`))
                )
              ).buffer as ArrayBuffer,
            })
          )
        ),
      };
      await new Promise<void>((resolve, reject) => {
        initWaiter = { resolve, reject };
        spawned.postMessage(payload, [
          payload.compilerWasm,
          ...payload.fonts.map((font) => font.data),
          ...payload.packages.map((pkg) => pkg.tarball),
        ]);
      });
    } catch (error) {
      teardown(
        error instanceof Error ? error : new Error(describeError(error))
      );
      throw error;
    }
  }

  function init(): Promise<void> {
    if (disposed) {
      return Promise.reject(new Error('Print compiler has been disposed'));
    }
    bootPromise ??= boot();
    return bootPromise;
  }

  /**
   * Convert the document and fetch every referenced asset. Returns the
   * complete file list (template + generated sources + asset bytes) and the
   * merged conversion/fetch diagnostics.
   */
  async function prepareFiles(document: PrintableContest): Promise<{
    mainPath: string;
    files: TypstWorkerFile[];
    diagnostics: PrintDiagnostic[];
  }> {
    const built = buildTypstFiles(document, {
      tid: options.tid,
      resolveFile: options.resolveFile,
    });
    const files: TypstWorkerFile[] = [...built.files];
    const diagnostics = [...built.diagnostics];
    // `asset-unresolved` diagnostics were already emitted during conversion.
    // Fetches run concurrently but file/diagnostic order stays deterministic.
    const fetched = await Promise.all(
      built.assets.map(async (ref) => {
        if (ref.url === null) return undefined;
        try {
          const bytes = await options.fetchAsset(ref.url);
          return { ref, bytes };
        } catch (error) {
          return { ref, error };
        }
      })
    );
    for (const result of fetched) {
      if (result === undefined) continue;
      if ('bytes' in result) {
        files.push({ path: `/${result.ref.path}`, bytes: result.bytes });
      } else {
        diagnostics.push({
          severity: 'error',
          code: 'asset-fetch-failed',
          message: `Failed to fetch asset ${result.ref.url} for ${result.ref.uri}: ${describeError(result.error)}`,
          location: {
            problemId:
              result.ref.scope.kind === 'problem'
                ? result.ref.scope.problemId
                : undefined,
            path: `/${result.ref.path}`,
          },
        });
      }
    }
    return { mainPath: built.mainPath, files, diagnostics };
  }

  async function compilePdf(
    document: PrintableContest
  ): Promise<PrintCompileResult> {
    const seq = ++latestCompileSeq;
    await init();
    // A newer call may already exist — skip the conversion/fetch work.
    if (seq !== latestCompileSeq) return { status: 'stale' };
    const prepared = await prepareFiles(document);
    if (seq !== latestCompileSeq) return { status: 'stale' };
    const id = ++nextRequestId;
    const response = await new Promise<CompiledResponse>((resolve, reject) => {
      const active = worker;
      if (active === null) {
        reject(new Error('Typst worker is not running'));
        return;
      }
      pending.set(id, { resolve, reject });
      // Dedupe the transfer list: two asset files may share one ArrayBuffer
      // (e.g. provider-cached bytes), and Chromium throws DataCloneError when
      // a buffer appears twice.
      active.postMessage(
        {
          kind: 'compile',
          id,
          mainPath: prepared.mainPath,
          files: prepared.files,
        },
        [
          ...new Set(
            prepared.files.flatMap((file) =>
              file.bytes !== undefined ? [file.bytes.buffer] : []
            )
          ),
        ]
      );
    });
    if (seq !== latestCompileSeq) return { status: 'stale' };
    const diagnostics = [
      ...prepared.diagnostics,
      ...response.diagnostics.map(mapTypstDiagnostic),
    ];
    if (
      response.pdf !== undefined &&
      !diagnostics.some((diagnostic) => diagnostic.severity === 'error')
    ) {
      return { status: 'ok', pdf: response.pdf, diagnostics };
    }
    return { status: 'diagnostics', diagnostics };
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    teardown(new Error('Print compiler has been disposed'));
  }

  return { init, compilePdf, dispose };
}
