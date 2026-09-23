import type { PrintDiagnostic, PrintableContest } from './model';

/**
 * Download/init stages reported while the compiler worker boots. `wasm` covers
 * the Typst compiler and renderer binaries, `fonts` the bundled font set, and
 * `packages` vendored Typst packages (e.g. mitex).
 */
export type PrintCompilerStage = 'wasm' | 'fonts' | 'packages';

export type PrintCompilerProgress = {
  stage: PrintCompilerStage;
  /** Bytes received so far across the stage's downloads. */
  loaded: number;
  /** Expected bytes when the server provides a length; undefined otherwise. */
  total?: number;
  /** Convenience value in [0, 100]; stays 0 while `total` is unknown. */
  percent: number;
};

/**
 * Result of a `compilePdf` call. Latest-wins semantics: when a newer compile
 * is requested while one is in flight, the superseded call resolves to
 * `{ status: 'stale' }` instead of cancelling mid-flight.
 *
 * `status: 'diagnostics'` means the document itself failed to compile; at
 * least one diagnostic has `severity: 'error'`. Infrastructure failures
 * (worker crash, init failure) reject the promise instead.
 */
export type PrintCompileResult =
  | { status: 'ok'; pdf: Uint8Array; diagnostics: PrintDiagnostic[] }
  | { status: 'diagnostics'; diagnostics: PrintDiagnostic[] }
  | { status: 'stale' };

/**
 * Fetches raw bytes for an asset URL resolved by the `PrintAssetProvider`.
 * The worker delegates fetches to the main thread so cookies/CDN rules and
 * `file://` resolution live in one place.
 */
export type PrintAssetFetch = (url: string) => Promise<Uint8Array>;

export type PrintCompilerOptions = {
  /** Called by the worker for every asset URI referenced by the document. */
  fetchAsset: PrintAssetFetch;
  /** Download/init progress events; may fire from an earlier cached boot. */
  onProgress?: (progress: PrintCompilerProgress) => void;
};

/**
 * Browser support gate for the compile worker. Typst.ts needs `Worker` and
 * `WebAssembly` only; unlike the clangd worker it does not require
 * cross-origin isolation or `SharedArrayBuffer`.
 */
export type PrintSupport = 'supported' | 'unsupported';

/**
 * The client-side print compiler. Implementations run Typst in a dedicated
 * worker (`typst.worker.ts`) but this interface is engine-agnostic so tests
 * can mock it.
 * One compiler instance is meant to be long-lived: `init` warms the wasm/fonts
 * once and `compilePdf` reuses the session.
 */
export interface PrintCompiler {
  /**
   * Start (or reuse) worker boot: spawn the worker, load wasm modules, fonts
   * and vendored packages. Idempotent — repeat calls return the same boot
   * promise. Rejects when a stage fails permanently.
   */
  init(): Promise<void>;
  /**
   * Convert the document to Typst and compile a PDF. Never throws for document
   * errors; rejects only on infrastructure failure.
   */
  compilePdf(document: PrintableContest): Promise<PrintCompileResult>;
  /** Terminate the worker and release wasm memory. No-op when not started. */
  dispose(): void;
}

/**
 * Factory contract implemented by `createTypstPrintCompiler` and by test
 * mocks.
 */
export type CreatePrintCompiler = (
  options: PrintCompilerOptions
) => PrintCompiler;
