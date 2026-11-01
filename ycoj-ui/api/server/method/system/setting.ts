import { alova } from '@/api/server';

export type SystemSettingType =
  | 'text'
  | 'textarea'
  | 'password'
  | 'number'
  | 'float'
  | 'markdown'
  | 'boolean'
  | 'select'
  | 'radio'
  | 'image_radio'
  | 'json'
  | string;

export type SystemSettingItem = {
  family: string;
  key: string;
  value: unknown;
  name: string;
  desc?: string | null;
  flag: number;
  subType?: string;
  type: SystemSettingType;
  range?: Record<string, string> | [string, string][] | null;
};

export type SystemSettingsResponse = {
  settings: SystemSettingItem[];
  current: Record<string, unknown>;
};

/** GET /manage/setting — requires PRIV_EDIT_SYSTEM and sudo. */
export const getSystemSettings = () =>
  alova.Get<SystemSettingsResponse>('/manage/setting', { cacheFor: 0 });
