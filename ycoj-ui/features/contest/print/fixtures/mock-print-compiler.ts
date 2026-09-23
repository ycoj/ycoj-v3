import type {
  CreatePrintCompiler,
  PrintCompileResult,
  PrintCompiler,
} from '../compiler';
import type { PrintableContest } from '../model';

export type MockPrintCompilerBehavior = {
  /**
   * Compile outcome: a fixed result or a per-document function. Defaults to
   * `{ status: 'ok' }` with a 4-byte fake PDF payload.
   */
  compile?:
    PrintCompileResult | ((document: PrintableContest) => PrintCompileResult);
  /** When set, `init()` rejects with this error. */
  initError?: Error;
  /** Emit one 100% progress event per stage during `init()`. */
  emitProgress?: boolean;
};

export type MockPrintCompilerCalls = {
  init: number;
  compilePdf: PrintableContest[];
  dispose: number;
};

/**
 * A `CreatePrintCompiler` factory for UI tests: no worker, no WASM. Every
 * call is recorded on `.calls`; behavior is fixed at construction.
 */
export type MockPrintCompiler = CreatePrintCompiler & {
  calls: MockPrintCompilerCalls;
};

const FAKE_PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

export function createMockPrintCompiler(
  behavior: MockPrintCompilerBehavior = {}
): MockPrintCompiler {
  const calls: MockPrintCompilerCalls = {
    init: 0,
    compilePdf: [],
    dispose: 0,
  };
  const create: CreatePrintCompiler = (options): PrintCompiler => ({
    async init() {
      calls.init += 1;
      if (behavior.emitProgress) {
        for (const stage of ['wasm', 'fonts', 'packages'] as const) {
          options.onProgress?.({ stage, loaded: 1, total: 1, percent: 100 });
        }
      }
      if (behavior.initError !== undefined) throw behavior.initError;
    },
    async compilePdf(document) {
      calls.compilePdf.push(document);
      const result =
        typeof behavior.compile === 'function'
          ? behavior.compile(document)
          : behavior.compile;
      return result ?? { status: 'ok', pdf: FAKE_PDF, diagnostics: [] };
    },
    dispose() {
      calls.dispose += 1;
    },
  });
  return Object.assign(create, { calls });
}
