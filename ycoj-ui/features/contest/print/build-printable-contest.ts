import { judgeLanguageExtension } from './judge-languages';
import type {
  BuildPrintableContest,
  BuildPrintableContestResult,
  PrintableContest,
  PrintDiagnostic,
  PrintLanguageSpec,
  PrintProblem,
} from './model';
import { isFileIoProblem } from '@/features/problem/detail/problem-type';
import {
  parseProblemContent,
  type SupportedProblemLanguage,
} from '@/features/problem/parse-problem-content';
import type {
  ContestDetailProjectionProblem,
  ProblemConfig,
} from '@/shared/types/problem';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

// A fixed zone keeps `dateText` identical across server, worker and test
// runs — the same convention `formatRecordTime` uses to avoid hydration
// drift.
const PRINT_TIME_ZONE = 'Asia/Shanghai';

const DEFAULT_STATEMENT_LANGUAGE: SupportedProblemLanguage = 'zh';
const DEFAULT_SUBMISSION_LANGUAGE: PrintLanguageSpec = {
  id: 'cc.cc14o2',
  displayName: 'C++',
  compileOptions: '-O2 -std=c++14 -static',
};

// Statement lookup order after the requested language: zh, en, then the
// first language the problem actually has.
const STATEMENT_FALLBACK_LANGUAGES: SupportedProblemLanguage[] = ['zh', 'en'];

function validConfig(value: unknown): value is ProblemConfig {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Printable `name` characters. Characters outside this set become `_`;
 * letters are lowercase and only the first seven characters are kept.
 */
function sanitizeShortName(raw: string): string {
  return raw
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
    .slice(0, 7);
}

/** Format the exact date/time line consumed by the CNOI title block. */
export function formatPrintDateText(beginAt: Date, endAt: Date): string {
  const begin = dayjs(beginAt).tz(PRINT_TIME_ZONE);
  const end = dayjs(endAt).tz(PRINT_TIME_ZONE);
  if (!begin.isValid() || !end.isValid()) return '';
  const includeSeconds = begin.second() !== 0 || end.second() !== 0;
  const timeFormat = includeSeconds ? 'HH:mm:ss' : 'HH:mm';
  const dateFormat = `YYYY年M月D日${timeFormat}`;
  const endText = begin.isSame(end, 'day')
    ? end.format(timeFormat)
    : end.format(dateFormat);
  return `${begin.format(dateFormat)} ~ ${endText}`;
}

export function formatPrintDateTimeInput(value: string): string {
  const date = dayjs(value).tz(PRINT_TIME_ZONE);
  return date.isValid() ? date.format('YYYY-MM-DDTHH:mm:ss') : '';
}

export function parsePrintDateTimeInput(value: string): string {
  const date = dayjs.tz(value, PRINT_TIME_ZONE);
  return date.isValid() ? date.toISOString() : '';
}

function toIsoString(value: Date): string {
  const time = dayjs(value);
  return time.isValid() ? time.toISOString() : '';
}

/**
 * Limit text is display-only: an integral number of milliseconds collapses
 * to seconds (`1000` → `1 s`), anything else stays in milliseconds
 * (`1500` → `1500 ms`). A min–max pair differing from max prints as
 * `min–max`; missing or non-positive bounds are dropped, and a wholly
 * missing limit yields an empty string (the table cell stays empty).
 */
function formatMsLimit(ms: number | undefined): string {
  if (ms === undefined || !Number.isFinite(ms) || ms <= 0) return '';
  return ms % 1000 === 0 ? `${ms / 1000} s` : `${ms} ms`;
}

function formatMbLimit(mb: number | undefined): string {
  if (mb === undefined || !Number.isFinite(mb) || mb <= 0) return '';
  return `${mb} MiB`;
}

function formatRangedLimit(
  min: number | undefined,
  max: number | undefined,
  format: (value: number | undefined) => string
): string {
  const lo = format(min);
  const hi = format(max);
  if (!hi) return lo;
  if (lo && lo !== hi) {
    // Shared units collapse to `1–2 s`; different units keep both
    // (`500 ms–1 s`).
    const [loAmount, loUnit] = lo.split(' ');
    const hiUnit = hi.slice(hi.lastIndexOf(' ') + 1);
    if (loUnit === hiUnit) return `${loAmount}–${hi}`;
    return `${lo}–${hi}`;
  }
  return hi;
}

/**
 * Statement language selection: the requested language first, then `zh`,
 * `en`, then whatever the problem has — each miss past the requested
 * language reports `language-fallback`; no text at all reports
 * `empty-statement`.
 */
function pickStatement(
  pdoc: ContestDetailProjectionProblem,
  language: SupportedProblemLanguage,
  diagnostics: PrintDiagnostic[]
): string {
  const entries = parseProblemContent(pdoc.content ?? '');
  if (!entries.length) {
    diagnostics.push({
      severity: 'warning',
      code: 'empty-statement',
      message: `Problem ${pdoc.docId} has no statement text`,
      location: { problemId: pdoc.docId },
    });
    return '';
  }

  const order = [language, ...STATEMENT_FALLBACK_LANGUAGES];
  const seen = new Set<string>();
  for (const candidate of order) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const entry = entries.find((item) => item.language === candidate);
    if (!entry) continue;
    if (candidate !== language) {
      diagnostics.push({
        severity: 'warning',
        code: 'language-fallback',
        message: `Problem ${pdoc.docId} has no '${language}' statement; using '${entry.language}'`,
        location: { problemId: pdoc.docId },
      });
    }
    return entry.content;
  }

  // None of the preferred languages exist: take the problem's first
  // available entry (`entries` is non-empty above).
  const fallback = entries[0];
  diagnostics.push({
    severity: 'warning',
    code: 'language-fallback',
    message: `Problem ${pdoc.docId} has no '${language}' statement; using '${fallback.language}'`,
    location: { problemId: pdoc.docId },
  });
  return fallback.content;
}

function buildProblem(
  pdoc: ContestDetailProjectionProblem,
  language: SupportedProblemLanguage,
  languages: readonly PrintLanguageSpec[],
  problemTypeLabels: Record<string, string> | undefined,
  diagnostics: PrintDiagnostic[]
): PrintProblem {
  const config = validConfig(pdoc.config) ? pdoc.config : null;
  if (!config) {
    diagnostics.push({
      severity: 'warning',
      code: 'internal-error',
      message: `Problem ${pdoc.docId} has no valid configuration`,
      location: { problemId: pdoc.docId },
    });
  }
  const pidName =
    sanitizeShortName(pdoc.pid ?? '') || sanitizeShortName(`p${pdoc.docId}`);
  const rawProblemType = config?.type ?? '';
  // The paper prints display text, not judge ids: resolve the localized
  // label for known `config.type` values, passthrough otherwise.
  const problemType = problemTypeLabels?.[rawProblemType] ?? rawProblemType;
  const fileIo = config !== null && isFileIoProblem(pdoc);
  // File-I/O names use the task file stem verbatim — `a+b.in`/`a+b.out`
  // pair with directory `a+b` and program `a+b.cpp`.
  const name = fileIo && config?.subType ? config.subType : pidName;
  const submitBase = name;

  return {
    problemId: pdoc.docId,
    ...(pdoc.pid !== undefined ? { pid: pdoc.pid } : {}),
    name,
    title: pdoc.title,
    problemType,
    statement: pickStatement(pdoc, language, diagnostics),
    timeLimit: formatRangedLimit(
      config?.timeMin,
      config?.timeMax,
      formatMsLimit
    ),
    memoryLimit: formatRangedLimit(
      config?.memoryMin,
      config?.memoryMax,
      formatMbLimit
    ),
    directory: submitBase,
    executable: `${submitBase}.cpp`,
    inputFile: fileIo ? `${config?.subType}.in` : '',
    outputFile: fileIo ? `${config?.subType}.out` : '',
    submitFilenames: languages.map(
      (lang) => `${submitBase}.${judgeLanguageExtension(lang.id)}`
    ),
    testcaseCount:
      Number.isFinite(config?.count) && (config?.count ?? 0) > 0
        ? String(config?.count)
        : '',
    scoreNote: '是',
    // Hydro has no per-problem pretest count, so the row stays hidden until
    // the editor fills it in.
    pretestCount: '',
  };
}

/**
 * Derive the printable document from a contest management response and
 * apply draft overrides. `problemOrder` reorders/filters `tdoc.pids` and may
 * add docIds absent from `pids` but present in `pdict`; ids with no `pdict`
 * entry emit `missing-problem` and are skipped. Per-problem overrides apply
 * verbatim (changing `name` does not re-derive `directory`/`executable`),
 * except `problemType`, which resolves raw judge type ids through
 * `problemTypeLabels` just like the derived defaults; override keys that
 * never made the printed list get an info diagnostic.
 * `problemTypeLabels` (optional) maps `pdoc.config.type` values to the
 * localized label printed in the overview table's problem-type row.
 * The build is deterministic: identical inputs produce a JSON-equal result.
 */
export const buildPrintableContest: BuildPrintableContest = (
  response,
  options
): BuildPrintableContestResult => {
  const diagnostics: PrintDiagnostic[] = [];
  const { tdoc, pdict } = response;
  const overrides = options?.overrides ?? {};
  const problemTypeLabels = options?.problemTypeLabels;

  const language = overrides.language ?? DEFAULT_STATEMENT_LANGUAGE;
  // `problemOrder` reorders/filters `tdoc.pids`; a repeated id prints once.
  const order = [...new Set(overrides.problemOrder ?? tdoc.pids)];
  const languages = overrides.languages ?? [{ ...DEFAULT_SUBMISSION_LANGUAGE }];

  const problems: PrintProblem[] = [];
  for (const docId of order) {
    const pdoc = pdict[docId];
    if (!pdoc) {
      diagnostics.push({
        severity: 'error',
        code: 'missing-problem',
        message: `Problem ${docId} is not part of the contest payload`,
        location: { problemId: docId },
      });
      continue;
    }
    problems.push(
      buildProblem(pdoc, language, languages, problemTypeLabels, diagnostics)
    );
  }

  const problemOverrides = overrides.problems ?? {};
  for (const key of Object.keys(problemOverrides)) {
    const problemId = Number(key);
    const index = problems.findIndex(
      (problem) => problem.problemId === problemId
    );
    if (index === -1) {
      diagnostics.push({
        severity: 'info',
        code: 'missing-problem',
        message: `Overrides for problem ${key} were ignored: it is not in the printed problem list`,
        ...(Number.isFinite(problemId) ? { location: { problemId } } : {}),
      });
      continue;
    }
    const override = problemOverrides[problemId];
    // `problemType` is printable display text: a raw `config.type` id typed
    // in the editor resolves to its localized label, free text passes
    // through verbatim.
    problems[index] = {
      ...problems[index],
      ...override,
      ...(override.problemType !== undefined
        ? {
            problemType:
              problemTypeLabels?.[override.problemType] ?? override.problemType,
          }
        : {}),
    };
  }

  const document: PrintableContest = {
    language,
    title: overrides.title ?? tdoc.title,
    subtitle: overrides.subtitle ?? '',
    dayName: overrides.dayName ?? '',
    dateText:
      overrides.dateText ?? formatPrintDateText(tdoc.beginAt, tdoc.endAt),
    beginAt: overrides.beginAt ?? toIsoString(tdoc.beginAt),
    endAt: overrides.endAt ?? toIsoString(tdoc.endAt),
    notice: overrides.notice ?? tdoc.content ?? '',
    noiStyle: overrides.noiStyle ?? true,
    fileIo:
      overrides.fileIo ??
      problems.some(
        (problem) => problem.inputFile !== '' || problem.outputFile !== ''
      ),
    usePretest: overrides.usePretest ?? false,
    languages,
    problems,
    extraSections: overrides.extraSections ?? [],
  };

  return { document, diagnostics };
};
