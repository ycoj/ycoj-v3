/**
 * Dedicated Typst/WASM compile worker for the printable-contest feature. It
 * is spawned by `createTypstPrintCompiler` via
 * `new Worker(new URL('./typst.worker.ts', import.meta.url))` — the only
 * module that touches `@myriaddreamin/typst.ts`, and it does so lazily inside
 * `init` so the worker script itself stays small.
 *
 * The compiler state is mutable and shared, so `init`/`compile` requests are
 * serialized through `queue`; the main thread implements latest-wins instead
 * of cancelling mid-flight.
 */
import type { TypstWorkerRequest, TypstWorkerResponse } from './typst-protocol';
import { VendoredPackageRegistry } from './vendored-package-registry';

// The project tsconfig only ships lib "dom"; describe the worker-side self
// narrowly instead of pulling in lib "webworker".
const scope = self as unknown as {
  postMessage(message: TypstWorkerResponse, transfer?: Transferable[]): void;
};

type TypstModule = typeof import('@myriaddreamin/typst.ts');
type TypstCompiler = ReturnType<TypstModule['createTypstCompiler']>;

let compiler: TypstCompiler | null = null;
let queue: Promise<void> = Promise.resolve();

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Serialize every request: the compiler's shadow FS is global mutable state. */
function enqueue(task: () => Promise<void>): void {
  queue = queue.catch(() => undefined).then(task);
}

async function initCompiler(
  message: Extract<TypstWorkerRequest, { kind: 'init' }>
): Promise<void> {
  if (compiler !== null) {
    throw new Error('Typst worker is already initialized');
  }
  const [
    { createTypstCompiler, MemoryAccessModel },
    {
      disableDefaultFontAssets,
      loadFonts,
      withAccessModel,
      withPackageRegistry,
    },
  ] = await Promise.all([
    import('@myriaddreamin/typst.ts'),
    import('@myriaddreamin/typst.ts/options.init'),
  ]);
  const accessModel = new MemoryAccessModel();
  const registry = new VendoredPackageRegistry(accessModel, message.packages);
  const next = createTypstCompiler();
  await next.init({
    getModule: () => message.compilerWasm,
    beforeBuild: [
      // Bundled fonts only — never reach out to the typst-assets CDN.
      disableDefaultFontAssets(),
      loadFonts(message.fonts.map((font) => new Uint8Array(font.data))),
      withAccessModel(accessModel),
      withPackageRegistry(registry),
    ],
  });
  compiler = next;
}

async function compilePdf(
  message: Extract<TypstWorkerRequest, { kind: 'compile' }>
): Promise<void> {
  if (compiler === null) {
    throw new Error('Typst worker is not initialized');
  }
  // Reset shadow state so stale problem/extra/asset files from a previous
  // compile cannot leak into this one, then write the complete file set.
  compiler.resetShadow();
  for (const file of message.files) {
    if (file.bytes !== undefined) {
      compiler.mapShadow(file.path, file.bytes);
    } else if (file.text !== undefined) {
      compiler.addSource(file.path, file.text);
    }
  }
  const { CompileFormatEnum } =
    await import('@myriaddreamin/typst.ts/compiler');
  const result = await compiler.compile({
    format: CompileFormatEnum.pdf,
    mainFilePath: message.mainPath,
  });
  const transfer: Transferable[] =
    result.result !== undefined ? [result.result.buffer] : [];
  scope.postMessage(
    {
      kind: 'compiled',
      id: message.id,
      pdf: result.result,
      diagnostics: (result.diagnostics ?? []).map((diagnostic) =>
        typeof diagnostic === 'string'
          ? {
              package: '',
              path: '',
              severity: 'error',
              range: '',
              message: diagnostic,
            }
          : {
              package: diagnostic.package,
              path: diagnostic.path,
              severity: diagnostic.severity,
              range: diagnostic.range,
              message: diagnostic.message,
            }
      ),
    },
    transfer
  );
}

self.onmessage = (event: MessageEvent<TypstWorkerRequest>) => {
  const message = event.data;
  if (message.kind === 'init') {
    enqueue(async () => {
      try {
        await initCompiler(message);
        scope.postMessage({ kind: 'ready' });
      } catch (error) {
        scope.postMessage({ kind: 'failed', message: describeError(error) });
      }
    });
    return;
  }
  if (message.kind === 'compile') {
    enqueue(async () => {
      try {
        await compilePdf(message);
      } catch (error) {
        scope.postMessage({
          kind: 'failed',
          id: message.id,
          message: describeError(error),
        });
      }
    });
  }
};

export {};
