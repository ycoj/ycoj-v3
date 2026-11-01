import {
  getSystemConfig,
  getSystemConfigSchema,
} from '@/api/server/method/system/config';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import 'server-only';

export type ConfigPageState =
  | { kind: 'data'; value: string; schema: Record<string, unknown> }
  | { kind: 'error'; message: string };

export const getConfigPage = cache(async (): Promise<ConfigPageState> => {
  const t = await getTranslations('system');
  try {
    const response = await getSystemConfig();
    throwBackendError(response);
    if (isSudoRequired(response)) redirect('/user/sudo');
    if ('value' in response && 'schema' in response) {
      return { kind: 'data', value: response.value, schema: response.schema };
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

/**
 * Loads the schema-only endpoint. Used when the config response omits its
 * embedded schema so validation still has something to check against.
 */
export const getConfigSchema = cache(
  async (): Promise<Record<string, unknown> | null> => {
    try {
      const response = await getSystemConfigSchema();
      throwBackendError(response);
      if (isSudoRequired(response)) return null;
      if (
        response &&
        typeof response === 'object' &&
        'properties' in response
      ) {
        return response;
      }
      return null;
    } catch {
      return null;
    }
  }
);
