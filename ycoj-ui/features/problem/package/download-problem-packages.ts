import { getProblemFileLinks } from '@/api/client/method/problem/files';
import {
  getProblemPackageDoc,
  type ProblemPackageDoc,
} from '@/api/client/method/problem/package';
import {
  buildProblemPackageEntries,
  problemZipFilename,
} from '@/features/problem/package/problem-package';
import type { ProblemFileType } from '@/shared/types/problem-file';
import JSZip from 'jszip';

const DOWNLOAD_CONCURRENCY = 4;

function triggerDownload(url: string, filename: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

function fileNames(doc: ProblemPackageDoc, type: ProblemFileType) {
  const files = type === 'testdata' ? doc.data : doc.additional_file;
  return (files ?? []).map((file) => file.name);
}

async function addProblemFiles(
  zip: JSZip,
  doc: ProblemPackageDoc,
  domainId: string,
  type: ProblemFileType
) {
  const names = fileNames(doc, type);
  if (!names.length) return;

  let links: Record<string, string> = {};
  try {
    const response = await getProblemFileLinks(
      doc.docId,
      names,
      type,
      undefined,
      domainId
    ).send();
    links = response?.links ?? {};
  } catch {
    // Testdata may be inaccessible (for example without data-read permission).
    // The statement part of the package is still useful, so keep it.
    return;
  }

  for (let index = 0; index < names.length; index += DOWNLOAD_CONCURRENCY) {
    const batch = names.slice(index, index + DOWNLOAD_CONCURRENCY);
    await Promise.all(
      batch.map(async (name) => {
        const url = links[name];
        if (!url) return;
        const response = await fetch(url);
        if (!response.ok) return;
        zip.file(`${doc.docId}/${type}/${name}`, await response.blob());
      })
    );
  }
}

async function addProblemToZip(
  zip: JSZip,
  domainId: string,
  docId: number
): Promise<ProblemPackageDoc | null> {
  const response = await getProblemPackageDoc(domainId, docId).send();
  if (!response || 'error' in response) return null;
  const doc = response as ProblemPackageDoc;

  for (const entry of buildProblemPackageEntries(doc)) {
    zip.file(entry.filename, entry.content);
  }
  await addProblemFiles(zip, doc, domainId, 'testdata');
  await addProblemFiles(zip, doc, domainId, 'additional_file');
  return doc;
}

/**
 * Exports one or more problems as a Hydro-compatible ZIP archive.
 *
 * @param docIds Numeric problem document IDs.
 * @param domainId Domain whose problems are exported.
 * @param filename Download name; single-problem exports default to the title.
 */
export async function downloadProblemPackages(
  docIds: number[],
  domainId: string,
  filename?: string
) {
  if (!docIds.length) return;

  const zip = new JSZip();
  const docs: ProblemPackageDoc[] = [];
  for (const docId of docIds) {
    const doc = await addProblemToZip(zip, domainId, docId);
    if (doc) docs.push(doc);
  }
  if (!docs.length) throw new Error('No readable problems');

  const name =
    filename ??
    (docs.length === 1 ? problemZipFilename(docs[0]) : 'Export.zip');
  const blob = await zip.generateAsync({ type: 'blob', streamFiles: true });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return docs;
}
