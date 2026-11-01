import { clientRequest } from '@/api/client';
import {
  getUploadBaseUrl,
  uploadFormFile,
} from '@/api/client/method/file-upload';
import type { Errorable } from '@/shared/types/error';

export type PersonalFilesMutationResponse = Errorable<{ url?: string }>;

/**
 * Uploads one file into the current user's personal file space.
 *
 * @param file File selected by the user. Its name becomes the stored name.
 */
export const uploadPersonalFile = (file: File) => {
  const form = new FormData();
  form.append('operation', 'upload_file');
  form.append('filename', file.name);
  form.append('file', file);
  return uploadFormFile<PersonalFilesMutationResponse>(
    `${getUploadBaseUrl()}/file`,
    form
  );
};

/**
 * Removes files from the current user's personal file space.
 *
 * @param files Stored file names to delete.
 */
export const deletePersonalFiles = (files: string[]) =>
  clientRequest.Post<PersonalFilesMutationResponse>('/file', {
    operation: 'delete_files',
    files,
  });

/**
 * Same-origin URL that redirects to a signed personal file download.
 *
 * @param uid Owner of the file; the backend only allows the owner or admins.
 * @param name Stored file name.
 */
export const getPersonalFileUrl = (uid: number, name: string) =>
  `/api/file/${uid}/${encodeURIComponent(name)}`;

/**
 * Resolves the signed URL for a personal file, for inline previews that need a
 * direct cross-origin source.
 *
 * @param uid Owner of the file; the backend only allows the owner or admins.
 * @param name Stored file name.
 */
export const resolvePersonalFileUrl = async (uid: number, name: string) => {
  const response = await clientRequest
    .Get<PersonalFilesMutationResponse>(
      `/file/${uid}/${encodeURIComponent(name)}`
    )
    .send();
  if ('error' in response) throw new Error(response.error.message ?? '');
  if (!response.url) throw new Error('missing file url');
  return response.url;
};
