import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type SaveSystemSettingsResponse = Errorable<{ url: string }>;

/**
 * POST /manage/setting.
 * `values` maps setting keys (including dotted keys) to their new values.
 * `booleanKeys` lets the backend disable boolean settings that are absent
 * from the current values snapshot.
 */
export const saveSystemSettings = (
  values: Record<string, Record<string, string>>,
  booleanKeys: Record<string, Record<string, true>>
) =>
  clientRequest.Post<SaveSystemSettingsResponse>('/manage/setting', {
    ...values,
    booleanKeys,
  });

const SystemSetting = { saveSystemSettings };
export default SystemSetting;
