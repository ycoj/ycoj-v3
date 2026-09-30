import 'server-only';
import ServerApis from '@/api/server/method';
import {
  BackendResponseError,
  throwBackendError,
} from '@/shared/lib/backend-response';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';

export type AiProviderPageState =
  | { kind: 'data'; config: AiProviderConfig }
  | { kind: 'error'; message: string };

export async function getAiProviderPage(): Promise<AiProviderPageState> {
  const t = await getTranslations('aiProvider');
  try {
    const response = await ServerApis.AiProvider.getAiProviderConfig();
    throwBackendError(response);
    if ('config' in response) {
      return {
        kind: 'data',
        config: JSON.parse(response.config) as AiProviderConfig,
      };
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
}
