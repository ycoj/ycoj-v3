import 'server-only';
import ServerApis from '@/api/server/method';
import {
  BackendResponseError,
  throwBackendError,
} from '@/shared/lib/backend-response';
import type { BrandingConfig } from '@/shared/types/branding';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';

export async function getBrandingPage(): Promise<
  { kind: 'data'; config: BrandingConfig } | { kind: 'error'; message: string }
> {
  const t = await getTranslations('branding');
  try {
    const response = await ServerApis.Branding.getBrandingConfig();
    throwBackendError(response);
    if ('config' in response) return { kind: 'data', config: response.config };
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
