import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type SaveSystemConfigResponse = Errorable<{ url: string }>;

/** POST /manage/config with the raw YAML source. */
export const saveSystemConfig = (value: string) =>
  clientRequest.Post<SaveSystemConfigResponse>('/manage/config', { value });

const SystemConfig = { saveSystemConfig };
export default SystemConfig;
