import { getJudgeStatus } from '@/api/server/method/status';
import {
  BackendResponseError,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import 'server-only';

export type JudgeStatusPageState =
  | { kind: 'data'; data: Awaited<ReturnType<typeof getJudgeStatus>> }
  | { kind: 'error'; message: string };

export const getJudgeStatusPage = cache(
  async (): Promise<JudgeStatusPageState> => {
    const t = await getTranslations('system');
    try {
      const response = await getJudgeStatus();
      throwBackendError(response);
      if ('stats' in response) return { kind: 'data', data: response };
      return { kind: 'error', message: t('loadFailed') };
    } catch (error) {
      unstable_rethrow(error);
      return {
        kind: 'error',
        message:
          error instanceof BackendResponseError
            ? error.message
            : t('loadFailed'),
      };
    }
  }
);
