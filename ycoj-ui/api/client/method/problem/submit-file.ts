import { uploadBaseUrl, uploadRequestConfig } from './upload-request';
import { uploadClientRequest } from '@/api/client';
import type { HydroError } from '@/shared/types/error';
import type { ObjectId } from '@/shared/types/shared';

export type ProblemSubmitFileResponse = {
  error?: HydroError;
  rid?: ObjectId;
  tid?: ObjectId;
  /** Framework redirect target when the backend answers without a record. */
  url?: string;
};

export type ProblemSubmitFilePayload = {
  lang: string;
  tid?: ObjectId;
};

/**
 * Submits code by file upload.
 *
 * The backend reads plain source files inline, but archives and binaries are
 * stored as the record's code file, so every file submission uses multipart
 * form data. An empty `code` field makes the backend prefer the uploaded file
 * over inline source.
 */
export const submitProblemFile = (
  pid: string,
  file: File,
  payload: ProblemSubmitFilePayload
) => {
  const form = new FormData();
  form.append('lang', payload.lang);
  form.append('code', '');
  form.append('file', file);

  const url = `${uploadBaseUrl()}/p/${pid}/submit`;
  return uploadClientRequest.Post<ProblemSubmitFileResponse>(
    url,
    form,
    uploadRequestConfig(url, payload.tid)
  );
};
