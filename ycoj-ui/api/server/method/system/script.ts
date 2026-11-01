import { alova } from '@/api/server';

export type SystemScriptInfo = {
  description?: string | null;
  hidden?: boolean;
};

export type SystemScriptsResponse = {
  scripts: Record<string, SystemScriptInfo>;
};

/** GET /manage/script — requires PRIV_EDIT_SYSTEM and sudo. */
export const getSystemScripts = () =>
  alova.Get<SystemScriptsResponse>('/manage/script', { cacheFor: 0 });
