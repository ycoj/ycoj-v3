/**
 * Structured-cloneable protocol between the main thread
 * (`createTypstPrintCompiler`) and `typst.worker.ts`. The main thread owns
 * all network access: wasm, fonts and package tarballs are fetched with
 * progress, then transferred to the worker in the `init` message. Document
 * assets are fetched per compile by the caller and appended to `files`.
 */

/** A vendored `@preview` package tarball (gzipped tar bytes). */
export type TypstPackageInput = {
  namespace: string;
  name: string;
  version: string;
  /** Gzipped tar bytes of the package, e.g. `mitex-0.2.7.tarball`. */
  tarball: ArrayBuffer;
};

/** One entry of the worker's in-memory filesystem; exactly one field is set. */
export type TypstWorkerFile = {
  /** Absolute shadow-FS path, e.g. `/problem-0.typ` or `/asset-ab12cd.png`. */
  path: string;
  /** Text sources (`.typ`, `content.json`) written via `addSource`. */
  text?: string;
  /** Binary payloads (images) written via `mapShadow`. */
  bytes?: Uint8Array;
};

export type TypstWorkerRequest =
  | {
      kind: 'init';
      /** `typst_ts_web_compiler_bg.wasm` bytes. */
      compilerWasm: ArrayBuffer;
      /** Font files registered via `loadFonts`. */
      fonts: Array<{ name: string; data: ArrayBuffer }>;
      /** Vendored package tarballs for `VendoredPackageRegistry`. */
      packages: TypstPackageInput[];
    }
  | {
      kind: 'compile';
      /** Correlates the `compiled`/`failed` response. */
      id: number;
      /** Entry file, always `/main.typ`. */
      mainPath: string;
      /** Complete file set; the worker resets shadow state per request. */
      files: TypstWorkerFile[];
    };

/** One diagnostic entry as reported by the Typst compiler. */
export type TypstWorkerDiagnostic = {
  package: string;
  path: string;
  severity: string;
  range: string;
  message: string;
};

export type TypstWorkerResponse =
  | { kind: 'ready' }
  | {
      kind: 'compiled';
      id: number;
      /** PDF artifact; absent when compilation produced diagnostics only. */
      pdf?: Uint8Array;
      diagnostics: TypstWorkerDiagnostic[];
    }
  | {
      /** Infrastructure failure. `id` absent when `init` itself failed. */
      kind: 'failed';
      id?: number;
      message: string;
    };
