import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import type { SupportedProblemLanguage } from '@/features/problem/parse-problem-content';

/**
 * Statement language selected for the printed paper. Reuses the per-problem
 * language keys understood by `parseProblemContent`.
 */
export type PrintStatementLanguage = SupportedProblemLanguage;

/**
 * One row of the submission-language / compile-options table in the paper.
 */
export type PrintLanguageSpec = {
  /** Judge language id, defaulting to `cc.cc14o2`. */
  id: string;
  /** Human-facing label printed in the paper, e.g. `C++17 (GCC 9)`. */
  displayName: string;
  /** Compile options printed verbatim, e.g. `-O2 -std=c++14 -static`. */
  compileOptions: string;
};

/**
 * A single problem as it appears on the printed paper. All printable fields
 * are display text: numeric judge limits are already formatted by the draft
 * builder, and every field except `problemId` may be overridden in the editor.
 */
export type PrintProblem = {
  /** `pdoc.docId`; keys diagnostics and problem-scoped asset resolution. */
  problemId: number;
  /** Platform pid when the problem has one (`pdoc.pid`), for reference only. */
  pid?: string;
  /**
   * Short ASCII identifier used as a fallback for generated file names.
   * YCOJ problems have no dedicated short name, so the builder derives it from
   * `pid` or falls back to `p${docId}`.
   */
  name: string;
  /** Title shown in the problem heading and the overview table. */
  title: string;
  /** Judge type passthrough (`pdoc.config.type`, e.g. `default`). */
  problemType: string;
  /** Statement markdown in the selected `PrintStatementLanguage`. */
  statement: string;
  /** Printable time limit, e.g. `1 s`. */
  timeLimit: string;
  /** Printable memory limit, e.g. `512 MiB`. */
  memoryLimit: string;
  /** Working directory name; defaults to the file-I/O stem or `name`. */
  directory: string;
  /** Program filename; defaults to `<file-I/O stem or name>.cpp`. */
  executable: string;
  /** Input file name, e.g. `task.in`; empty string means standard input. */
  inputFile: string;
  /** Output file name, e.g. `task.out`; empty string means standard output. */
  outputFile: string;
  /**
   * Expected submission file names, one entry per language in
   * `PrintableContest.languages` when the paper prints per-language rows.
   */
  submitFilenames: string[];
  /** Testcase count text; defaults to `pdoc.config.count`. */
  testcaseCount: string;
  /**
   * Subtask/score note for the overview table (equal-split, subtask weights,
   * …). Empty string hides the row.
   */
  scoreNote: string;
  /** Pretest count text; empty string hides the row. */
  pretestCount: string;
};

/**
 * A free-form markdown section appended after the problems, e.g. precautions
 * or announcements.
 */
export type PrintExtraSection = {
  /** Stable key used for ordering and diagnostics. */
  id: string;
  markdown: string;
};

/**
 * The printable contest document. This is the single payload sent to the
 * compile worker, so every field must stay structured-cloneable (no `Date`,
 * `FileInfo`, or class instances).
 */
export type PrintableContest = {
  /** Statement language used when picking per-problem markdown. */
  language: PrintStatementLanguage;
  /** Main title on the cover/first page; defaults to `tdoc.title`. */
  title: string;
  /** Secondary title line (session/day name); empty when unused. */
  subtitle: string;
  /** Session/day label printed beside the problem name in running headers. */
  dayName: string;
  /**
   * Free-form date/session line printed on the info page; the builder derives
   * it from `beginAt`/`endAt` and editors may override the text.
   */
  dateText: string;
  /** Contest window as ISO 8601 strings, from `tdoc.beginAt`/`endAt`. */
  beginAt: string;
  endAt: string;
  /** Contest description/notice markdown; defaults to `tdoc.content`. */
  notice: string;
  /** Whether the paper uses NOI-style wording and sections. */
  noiStyle: boolean;
  /** Whether the paper describes file I/O in the overview table. */
  fileIo: boolean;
  /** Whether the paper prints the pretest row/section. */
  usePretest: boolean;
  /** Compile-option rows printed in the submission table. */
  languages: PrintLanguageSpec[];
  /** Problems in print order; defaults to `tdoc.pids` order. */
  problems: PrintProblem[];
  /** Extra markdown sections printed after the problems. */
  extraSections: PrintExtraSection[];
};

/** Sparse per-problem draft overrides keyed implicitly by `problemId`. */
export type PrintProblemOverrides = Partial<Omit<PrintProblem, 'problemId'>>;

/**
 * Sparse contest-level draft overrides. Every field of the printable document
 * except the problem list is directly overridable; `problemOrder` reorders
 * `tdoc.pids` and `problems` applies per-problem overrides on top.
 */
export type PrintContestOverrides = Partial<
  Omit<PrintableContest, 'problems'>
> & {
  /** Explicit `pdoc.docId` order; defaults to `tdoc.pids`. */
  problemOrder?: number[];
  /** Per-problem overrides keyed by `pdoc.docId`. */
  problems?: Record<number, PrintProblemOverrides>;
};

export type BuildPrintableContestOptions = {
  overrides?: PrintContestOverrides;
};

/**
 * Draft builder output: the derived document plus every diagnostic the
 * derivation produced, so the editor can surface them before compiling.
 */
export type BuildPrintableContestResult = {
  document: PrintableContest;
  diagnostics: PrintDiagnostic[];
};

/**
 * Draft builder contract: derive a `PrintableContest` from a management
 * response and apply overrides. Implemented by `buildPrintableContest`;
 * deterministic — same inputs produce a JSON-equal result.
 */
export type BuildPrintableContest = (
  response: ContestManagementResponse,
  options?: BuildPrintableContestOptions
) => BuildPrintableContestResult;

/** Machine-readable diagnostic codes produced by the print pipeline. */
export type PrintDiagnosticCode =
  /** A `pids` entry has no matching `pdict` doc. */
  | 'missing-problem'
  /** The selected language is absent; another language was used. */
  | 'language-fallback'
  /** The statement is empty for the selected language. */
  | 'empty-statement'
  /** A `file://` name is not in the contest/problem asset scope. */
  | 'asset-unresolved'
  /** Fetching a resolved asset URL failed. */
  | 'asset-fetch-failed'
  /** A markdown construct has no Typst mapping. */
  | 'unsupported-markdown'
  /** A code-block line exceeds the printable width. */
  | 'overlong-code-line'
  /** Diagnostic reported by the Typst compiler itself. */
  | 'typst-diagnostic'
  /** Unclassified internal failure. */
  | 'internal-error';

export type PrintDiagnosticSeverity = 'error' | 'warning' | 'info';

/**
 * A pipeline diagnostic surfaced in the editor. `location` ties it back to a
 * problem and, when available, a markdown node type or a Typst source range.
 */
export type PrintDiagnostic = {
  severity: PrintDiagnosticSeverity;
  code: PrintDiagnosticCode;
  /** Human-readable, user-facing message. */
  message: string;
  location?: {
    /** `pdoc.docId` of the problem that produced the diagnostic. */
    problemId?: number;
    /** mdast node type, e.g. `image`, `inlineMath`, `containerDirective`. */
    nodeType?: string;
    /** Shadow-FS path of the Typst source, e.g. `/problem-0.typ`. */
    path?: string;
    /** Typst `full`-format range string, e.g. `2:9-3:15`. */
    range?: string;
  };
};
