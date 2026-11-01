import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type RunSystemScriptResponse = Errorable<{ rid: string; url: string }>;

/** POST /manage/script — runs a registered admin script and returns its record. */
export const runSystemScript = (id: string, args: string) =>
  clientRequest.Post<RunSystemScriptResponse>('/manage/script', { id, args });

const SystemScript = { runSystemScript };
export default SystemScript;
