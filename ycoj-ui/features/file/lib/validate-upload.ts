import type { FileInfo } from '@/shared/types/file';

export type UploadRejectionReason =
  'invalidName' | 'duplicateName' | 'exceedsCount' | 'exceedsTotal';

export type UploadRejection = {
  name: string;
  reason: UploadRejectionReason;
};

export type UploadLimits = {
  maxFileCount: number;
  maxTotalBytes: number;
};

export type UploadSelection = {
  accepted: File[];
  rejected: UploadRejection[];
};

/**
 * Mirrors the Hydro defaults for contest/training files and personal files.
 * Deployments can raise these limits, so the backend remains authoritative;
 * this only keeps clearly impossible selections from reaching it.
 */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxFileCount: 100,
  maxTotalBytes: 128 * 1024 * 1024,
};

// Mirrors the backend Filename validator: no path separators or reserved
// characters, at most 255 characters after trimming.
const INVALID_FILENAME_CHARS = /[\\/?#~!|*]/;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function isValidUploadFileName(name: string): boolean {
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 255 &&
    !INVALID_FILENAME_CHARS.test(trimmed) &&
    !CONTROL_CHARS.test(trimmed)
  );
}

export function validateUploadSelection(
  files: readonly File[],
  existing: readonly Pick<FileInfo, 'name' | 'size'>[],
  limits: UploadLimits = DEFAULT_UPLOAD_LIMITS
): UploadSelection {
  const seenNames = new Set(existing.map((file) => file.name));
  const accepted: File[] = [];
  const rejected: UploadRejection[] = [];
  let fileCount = existing.length;
  let totalBytes = existing.reduce((sum, file) => sum + file.size, 0);

  for (const file of files) {
    if (!isValidUploadFileName(file.name)) {
      rejected.push({ name: file.name, reason: 'invalidName' });
      continue;
    }
    if (seenNames.has(file.name)) {
      rejected.push({ name: file.name, reason: 'duplicateName' });
      continue;
    }
    // The backend compares the existing count before adding, and the resulting
    // total size before accepting. Mirror both boundaries.
    if (fileCount >= limits.maxFileCount) {
      rejected.push({ name: file.name, reason: 'exceedsCount' });
      continue;
    }
    if (totalBytes + file.size >= limits.maxTotalBytes) {
      rejected.push({ name: file.name, reason: 'exceedsTotal' });
      continue;
    }

    accepted.push(file);
    seenNames.add(file.name);
    fileCount += 1;
    totalBytes += file.size;
  }

  return { accepted, rejected };
}
