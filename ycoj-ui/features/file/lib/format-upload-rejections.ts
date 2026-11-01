import type { UploadRejection } from './validate-upload';

export type RejectionReasonMessages = Record<UploadRejection['reason'], string>;

/**
 * Builds the user-facing summary shown when part of a selection is rejected
 * before upload. Reasons are translated by the caller.
 *
 * @param line Template containing `{name}` and `{reason}` placeholders.
 */
export function formatUploadRejections(
  rejections: readonly UploadRejection[],
  reasons: RejectionReasonMessages,
  line: string
): string {
  return rejections
    .map((rejection) =>
      line
        .replace('{name}', rejection.name)
        .replace('{reason}', reasons[rejection.reason])
    )
    .join('\n');
}
