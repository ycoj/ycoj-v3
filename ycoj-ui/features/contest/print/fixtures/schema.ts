import type {
  PrintableContest,
  PrintDiagnostic,
  PrintProblem,
} from '@/features/contest/print/model';
import { z } from 'zod';

/**
 * Zod schemas mirroring the `model.ts` contracts. The document crosses to the
 * compile worker via `postMessage`, so these schemas are the runtime check for
 * fixtures and for documents persisted/imported by the editor.
 */
export const printStatementLanguageSchema = z.enum([
  'zh',
  'zh_TW',
  'kr',
  'en',
  'jp',
]);

export const printLanguageSpecSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  compileOptions: z.string(),
});

export const printProblemSchema = z.object({
  problemId: z.number().int().positive(),
  pid: z.string().optional(),
  name: z.string(),
  title: z.string(),
  problemType: z.string(),
  statement: z.string(),
  timeLimit: z.string(),
  memoryLimit: z.string(),
  directory: z.string(),
  executable: z.string(),
  inputFile: z.string(),
  outputFile: z.string(),
  submitFilenames: z.array(z.string()),
  testcaseCount: z.string(),
  scoreNote: z.string(),
  pretestCount: z.string(),
});

export const printExtraSectionSchema = z.object({
  id: z.string(),
  markdown: z.string(),
});

export const printableContestSchema = z.object({
  language: printStatementLanguageSchema,
  title: z.string(),
  subtitle: z.string(),
  dateText: z.string(),
  beginAt: z.string(),
  endAt: z.string(),
  notice: z.string(),
  noiStyle: z.boolean(),
  fileIo: z.boolean(),
  usePretest: z.boolean(),
  languages: z.array(printLanguageSpecSchema),
  problems: z.array(printProblemSchema),
  extraSections: z.array(printExtraSectionSchema),
});

export const printDiagnosticSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  code: z.enum([
    'missing-problem',
    'language-fallback',
    'empty-statement',
    'asset-unresolved',
    'asset-fetch-failed',
    'unsupported-markdown',
    'overlong-code-line',
    'typst-diagnostic',
    'internal-error',
  ]),
  message: z.string(),
  location: z
    .object({
      // Diagnostics echo whatever id the input carried — including
      // malformed/non-positive docIds on `missing-problem` — so this stays
      // an unconstrained number rather than a validity gate.
      problemId: z.number().optional(),
      nodeType: z.string().optional(),
      path: z.string().optional(),
      range: z.string().optional(),
    })
    .optional(),
});

// Keep schemas and hand-written model types mutually assignable.
type Assert<T extends true> = T;
true satisfies Assert<
  z.infer<typeof printableContestSchema> extends PrintableContest
    ? PrintableContest extends z.infer<typeof printableContestSchema>
      ? z.infer<typeof printProblemSchema> extends PrintProblem
        ? PrintProblem extends z.infer<typeof printProblemSchema>
          ? z.infer<typeof printDiagnosticSchema> extends PrintDiagnostic
            ? PrintDiagnostic extends z.infer<typeof printDiagnosticSchema>
              ? true
              : false
            : false
          : false
        : false
      : false
    : false
>;
