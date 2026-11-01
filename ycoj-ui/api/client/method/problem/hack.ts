import { uploadBaseUrl, uploadRequestConfig } from './upload-request';
import { uploadClientRequest } from '@/api/client';
import type { HydroError } from '@/shared/types/error';
import type { ObjectId } from '@/shared/types/shared';

/** A failed hack carries the backend `HackFailedError` message. */
export type HackSubmitResponse = {
  error?: HydroError;
  rid?: ObjectId;
};

export type HackSubmitPayload = {
  /** Raw input pasted into the form; ignored when `file` is set. */
  input?: string;
  /** Input file uploads are limited to 2 MiB by the backend. */
  file?: File | null;
  autoOrganizeInput?: boolean;
  tid?: ObjectId;
};

/** Input file limit enforced by the backend for hack submissions. */
export const HACK_INPUT_FILE_LIMIT = 2 * 1024 * 1024;

/**
 * Creates a hack record against another user's accepted submission.
 *
 * The route always accepts multipart form data so either a pasted input or a
 * small input file can be sent without a second request shape.
 */
export const submitProblemHack = (
  pid: string | number,
  rid: string,
  payload: HackSubmitPayload
) => {
  const form = new FormData();
  if (payload.file) form.append('file', payload.file);
  else form.append('input', payload.input ?? '');
  form.append('autoOrganizeInput', String(Boolean(payload.autoOrganizeInput)));

  const url = `${uploadBaseUrl()}/p/${pid}/hack/${rid}`;
  return uploadClientRequest.Post<HackSubmitResponse>(
    url,
    form,
    uploadRequestConfig(url, payload.tid)
  );
};
