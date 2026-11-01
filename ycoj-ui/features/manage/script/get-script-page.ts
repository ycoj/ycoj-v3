import { getSystemScripts } from '@/api/server/method/system/script';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import 'server-only';

export type ScriptListItem = {
  id: string;
  description?: string;
};

export type ScriptPageState =
  | { kind: 'data'; scripts: ScriptListItem[] }
  | { kind: 'error'; message: string };

export const getScriptPage = cache(async (): Promise<ScriptPageState> => {
  const t = await getTranslations('system');
  try {
    const response = await getSystemScripts();
    throwBackendError(response);
    if (isSudoRequired(response)) redirect('/user/sudo');
    if ('scripts' in response) {
      const scripts = Object.entries(response.scripts ?? {})
        .filter(([, info]) => !info?.hidden)
        .map(([id, info]) => ({
          id,
          description:
            typeof info?.description === 'string'
              ? info.description
              : undefined,
        }))
        .sort((first, second) => first.id.localeCompare(second.id));
      return { kind: 'data', scripts };
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
