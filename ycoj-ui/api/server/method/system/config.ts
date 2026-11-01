import { alova } from '@/api/server';

export type SystemConfigResponse = {
  /** YAML source with secrets replaced by `[hidden]`. */
  value: string;
  /** Combined JSON Schema for the current settings. */
  schema: Record<string, unknown>;
};

/** GET /manage/config — requires PRIV_EDIT_SYSTEM and sudo. */
export const getSystemConfig = () =>
  alova.Get<SystemConfigResponse>('/manage/config', { cacheFor: 0 });

/** GET /manage/config/schema.json — requires PRIV_EDIT_SYSTEM. */
export const getSystemConfigSchema = () =>
  alova.Get<Record<string, unknown>>('/manage/config/schema.json', {
    cacheFor: 0,
  });
