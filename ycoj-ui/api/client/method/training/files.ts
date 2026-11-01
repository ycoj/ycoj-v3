import { clientRequest } from '@/api/client';
import {
  getUploadBaseUrl,
  uploadFormFile,
} from '@/api/client/method/file-upload';
import type { Errorable } from '@/shared/types/error';

export type TrainingFilesMutationResponse = Errorable<{ url?: string }>;

/**
 * Uploads one attachment to a training.
 *
 * @param tid Training identifier.
 * @param file File selected by the user. Its name becomes the stored name.
 */
export const uploadTrainingFile = (tid: string, file: File) => {
  const form = new FormData();
  form.append('operation', 'upload_file');
  form.append('filename', file.name);
  form.append('file', file);
  return uploadFormFile<TrainingFilesMutationResponse>(
    `${getUploadBaseUrl()}/training/${encodeURIComponent(tid)}/file`,
    form
  );
};

/**
 * Removes attachments from a training.
 *
 * @param tid Training identifier.
 * @param files Stored attachment names to delete.
 */
export const deleteTrainingFiles = (tid: string, files: string[]) =>
  clientRequest.Post<TrainingFilesMutationResponse>(
    `/training/${encodeURIComponent(tid)}/file`,
    { operation: 'delete_files', files }
  );

/**
 * Same-origin URL that redirects to a signed attachment download.
 *
 * @param tid Training identifier.
 * @param name Stored attachment name.
 */
export const getTrainingFileUrl = (tid: string, name: string) =>
  `/api/training/${encodeURIComponent(tid)}/file/${encodeURIComponent(name)}`;

/**
 * Resolves the signed URL for an attachment, for inline previews that need a
 * direct cross-origin source.
 *
 * @param tid Training identifier.
 * @param name Stored attachment name.
 */
export const resolveTrainingFileUrl = async (tid: string, name: string) => {
  const response = await clientRequest
    .Get<TrainingFilesMutationResponse>(
      `/training/${encodeURIComponent(tid)}/file/${encodeURIComponent(name)}`
    )
    .send();
  if ('error' in response) throw new Error(response.error.message ?? '');
  if (!response.url) throw new Error('missing file url');
  return response.url;
};
