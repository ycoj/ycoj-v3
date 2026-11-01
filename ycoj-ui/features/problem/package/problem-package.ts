import type { ProblemPackageDoc } from '@/api/client/method/problem/package';
import { dump } from 'js-yaml';

export type ProblemPackageTextEntry = {
  filename: string;
  content: string;
};

/** Removes characters that cannot appear in a ZIP entry or download name. */
export function sanitizePackageName(name: string) {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function problemZipFilename(doc: ProblemPackageDoc) {
  const title = sanitizePackageName(doc.title);
  return sanitizePackageName(`${doc.docId} ${title}`) + '.zip';
}

/**
 * The statement column may hold one Markdown string or a JSON object mapping
 * language codes to Markdown. Both shapes are written as separate files in
 * the package so the Hydro importer can pick them up.
 */
export function statementEntries(
  content: string | undefined,
  directory: string
): ProblemPackageTextEntry[] {
  if (!content) return [];
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Not a language map');
    }
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string')
      .map(([lang, value]) => ({
        filename: `${directory}/problem_${sanitizePackageName(lang)}.md`,
        content: value as string,
      }));
    // An empty map is equivalent to no statement rather than an empty file.
    return entries.length ? entries : [];
  } catch {
    return [{ filename: `${directory}/problem.md`, content }];
  }
}

/**
 * Builds the text files of one Hydro problem package. Testdata and additional
 * files are added by the downloader after their signed URLs resolve.
 */
export function buildProblemPackageEntries(
  doc: ProblemPackageDoc
): ProblemPackageTextEntry[] {
  const directory = String(doc.docId);
  const problemYaml = dump({
    pid: doc.pid,
    owner: doc.owner,
    title: doc.title,
    tag: doc.tag ?? [],
    nSubmit: doc.nSubmit ?? 0,
    nAccept: doc.nAccept ?? 0,
  });

  return [
    { filename: `${directory}/problem.yaml`, content: problemYaml },
    ...statementEntries(doc.content, directory),
  ];
}
