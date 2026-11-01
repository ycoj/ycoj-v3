import {
  getSystemSettings,
  type SystemSettingsResponse,
} from '@/api/server/method/system/setting';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import 'server-only';

export type SettingPageState =
  | { kind: 'data'; data: SystemSettingsResponse }
  | { kind: 'error'; message: string };

export const getSettingPage = cache(async (): Promise<SettingPageState> => {
  const t = await getTranslations('system');
  try {
    const response = await getSystemSettings();
    throwBackendError(response);
    if (isSudoRequired(response)) redirect('/user/sudo');
    if ('settings' in response && 'current' in response) {
      return { kind: 'data', data: response };
    }
    return { kind: 'error', message: t('loadFailed') };
  } catch (error) {
    unstable_rethrow(error);
    return {
      kind: 'error',
      message:
        error instanceof BackendResponseError ? error.message : t('loadFailed'),
    };
  }
});
