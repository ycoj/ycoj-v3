import {
  getUserPrivileges,
  type SystemUserPrivAccount,
} from '@/api/server/method/system/user-priv';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';
import 'server-only';

export type UserPrivPageData = {
  accounts: SystemUserPrivAccount[];
  defaultPriv: number;
  priv: Record<string, number>;
};

export type UserPrivPageState =
  { kind: 'data'; data: UserPrivPageData } | { kind: 'error'; message: string };

export const getUserPrivPage = cache(async (): Promise<UserPrivPageState> => {
  const t = await getTranslations('system');
  try {
    const response = await getUserPrivileges();
    throwBackendError(response);
    if (isSudoRequired(response)) redirect('/user/sudo');
    if ('udocs' in response && 'Priv' in response) {
      return {
        kind: 'data',
        data: {
          accounts: response.udocs ?? [],
          defaultPriv: response.defaultPriv,
          priv: response.Priv ?? {},
        },
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
});
