import type { PrintAssetRef, PrintAssetScope } from './assets';
import { markdownToTypst } from './markdown-to-typst';
import type { PrintDiagnostic, PrintableContest } from './model';
import { CODE_THEME_SOURCE } from './template/code-theme';
import { MAIN_SOURCE } from './template/main';
import { PREAMBLE_SOURCE } from './template/preamble';

/**
 * Shadow-FS file-naming contract shared by `main.typ`, the worker, and the
 * source-export zip. All paths are absolute within the compiler's in-memory
 * filesystem; `content.json` stores the same names relative to `/` so the
 * template can `include problem.file` / `include extra.file` verbatim.
 */
export const PRINT_MAIN_PATH = '/main.typ';
export const PRINT_PREAMBLE_PATH = '/preamble.typ';
export const PRINT_CONTENT_PATH = '/content.json';
export const PRINT_NOTICE_PATH = '/notice.typ';
export const PRINT_CODE_THEME_PATH = '/tuackCodeTheme.tmTheme';

export function problemSourcePath(index: number): string {
  return `/problem-${index}.typ`;
}

export function extraSourcePath(id: string): string {
  return `/extra-${id}.typ`;
}

/**
 * A file mapped into the compiler shadow FS.
 * Exactly one of `text`/`bytes` is set: Typst/JSON sources use `text`, binary
 * assets use `bytes`.
 */
export type TypstSourceFile = {
  path: string;
  text?: string;
  bytes?: Uint8Array;
};

export type BuildTypstFilesOptions = {
  /**
   * Contest id stamped into `PrintAssetScope`s; needed only by
   * `resolveFile` implementations that read `scope.tid`.
   */
  tid?: string;
  /**
   * Maps a `file://` attachment name to a fetchable URL (contest scope:
   * `/api/contest/{tid}/file/public/{name}`, problem scope:
   * `/api/p/{docId}/file/{name}?tid={tid}`). Defaults to always `null`,
   * which surfaces `asset-unresolved` diagnostics for `file://` images.
   */
  resolveFile?: (scope: PrintAssetScope, filename: string) => string | null;
};

export type BuiltTypstFiles = {
  /** Entry point passed to the worker (`PRINT_MAIN_PATH`). */
  mainPath: string;
  /**
   * Sources/assets in write order: template + generated sources first,
   * `content.json` last. Image bytes are appended by the caller after
   * fetching `assets`.
   */
  files: TypstSourceFile[];
  /**
   * Asset references collected across all converted sections, deduplicated
   * by shadow path. The caller fetches `url` (when non-null) and appends
   * `{ path: `/${ref.path}`, bytes }` to `files`.
   */
  assets: PrintAssetRef[];
  diagnostics: PrintDiagnostic[];
};

/**
 * JSON payload read by `main.typ` as `content.json`. Statements are excluded —
 * they live in their own files referenced by `file` fields.
 */
type PrintContentJson = {
  language: PrintableContest['language'];
  title: string;
  subtitle: string;
  dayName: string;
  dateText: string;
  beginAt: string;
  endAt: string;
  noiStyle: boolean;
  fileIo: boolean;
  usePretest: boolean;
  hasNotice: boolean;
  languages: PrintableContest['languages'];
  problems: Array<
    Omit<PrintableContest['problems'][number], 'statement'> & { file: string }
  >;
  extraSections: Array<{ id: string; file: string }>;
};

/** `#import` header prepended to every generated markdown-derived source. */
const PREAMBLE_IMPORT = '#import "preamble.typ": *\n';

/**
 * Sanitize an `extraSections[].id` into a filesystem-safe file stem: keep
 * ASCII alphanumerics, `-` and `_`, collapse the rest, fall back to
 * `section` for empty results.
 */
export function sanitizeExtraSectionId(rawId: string): string {
  const cleaned = rawId
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
  // Require at least one alphanumeric so punctuation-only ids do not
  // produce degenerate file names.
  return /[A-Za-z0-9]/.test(cleaned) ? cleaned : 'section';
}

/**
 * Convert every markdown section of the document to Typst and assemble the
 * full shadow-FS file list. Deterministic: identical input produces
 * identical files, asset refs and diagnostics.
 *
 * Asset *bytes* are intentionally not handled here — the caller fetches them
 * (progress-aware or zip-writing) and appends `/${ref.path}` files.
 */
export function buildTypstFiles(
  document: PrintableContest,
  options: BuildTypstFilesOptions = {}
): BuiltTypstFiles {
  const diagnostics: PrintDiagnostic[] = [];
  const assetRefs: PrintAssetRef[] = [];
  const tid = options.tid ?? '';
  const resolveFile = options.resolveFile ?? (() => null);

  const files: TypstSourceFile[] = [
    { path: PRINT_MAIN_PATH, text: MAIN_SOURCE },
    { path: PRINT_PREAMBLE_PATH, text: PREAMBLE_SOURCE },
    { path: PRINT_CODE_THEME_PATH, text: CODE_THEME_SOURCE },
  ];

  const contestScope: PrintAssetScope = { kind: 'contest', tid };
  const convert = (
    markdown: string,
    scope: PrintAssetScope,
    problemId?: number
  ) => {
    const result = markdownToTypst(markdown, {
      problemId,
      scope,
      resolveFile: (filename) => resolveFile(scope, filename),
    });
    diagnostics.push(...result.diagnostics);
    assetRefs.push(...result.assets);
    return PREAMBLE_IMPORT + result.typst;
  };

  const problems = document.problems.map((problem, index) => {
    const { statement, ...printable } = problem;
    const scope: PrintAssetScope = {
      kind: 'problem',
      tid,
      problemId: problem.problemId,
    };
    files.push({
      path: problemSourcePath(index),
      text: convert(statement, scope, problem.problemId),
    });
    return { ...printable, file: problemSourcePath(index).slice(1) };
  });

  let hasNotice = false;
  if (document.notice.trim().length > 0) {
    files.push({
      path: PRINT_NOTICE_PATH,
      text: convert(document.notice, contestScope),
    });
    hasNotice = true;
  }

  const usedExtraIds = new Set<string>();
  const extraSections = document.extraSections.map((section) => {
    const base = sanitizeExtraSectionId(section.id);
    let candidate = base;
    for (let n = 2; usedExtraIds.has(candidate); n += 1) {
      candidate = `${base}-${n}`;
    }
    usedExtraIds.add(candidate);
    files.push({
      path: extraSourcePath(candidate),
      text: convert(section.markdown, contestScope),
    });
    return { id: section.id, file: extraSourcePath(candidate).slice(1) };
  });

  const content: PrintContentJson = {
    language: document.language,
    title: document.title,
    subtitle: document.subtitle,
    dayName: document.dayName,
    dateText: document.dateText,
    beginAt: document.beginAt,
    endAt: document.endAt,
    noiStyle: document.noiStyle,
    fileIo: document.fileIo,
    usePretest: document.usePretest,
    hasNotice,
    languages: document.languages,
    problems,
    extraSections,
  };
  files.push({ path: PRINT_CONTENT_PATH, text: JSON.stringify(content) });

  const seenAssetPaths = new Set<string>();
  const assets = assetRefs.filter((ref) => {
    if (seenAssetPaths.has(ref.path)) return false;
    seenAssetPaths.add(ref.path);
    return true;
  });

  return { mainPath: PRINT_MAIN_PATH, files, assets, diagnostics };
}
