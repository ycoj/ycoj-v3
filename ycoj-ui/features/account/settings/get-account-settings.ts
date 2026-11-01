'server-only';

import ServerApis from '@/api/server/method';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import { isSudoRequired } from '@/shared/lib/backend-response';
import type { UserSettingsCategory } from '@/shared/types/account-settings';
import { redirect } from 'next/navigation';
import { cache } from 'react';

function isAuthFailure(response: object) {
  return (
    'url' in response ||
    ('error' in response &&
      typeof response.error === 'object' &&
      response.error !== null &&
      'name' in response.error &&
      (response.error.name === 'PermissionError' ||
        response.error.name === 'PrivilegeError'))
  );
}

/**
 * Loads one settings category. Sudo-protected pages redirect to the shared
 * confirmation flow, and authentication failures redirect to login.
 */
export const getUserSettings = cache(async (category: UserSettingsCategory) => {
  const user = await getUser();
  if (!user?._id || !hasPriv(user, PRIV.PRIV_USER_PROFILE)) redirect('/login');
  const data = await ServerApis.Account.getUserSettings(category);
  if (isSudoRequired(data)) redirect('/user/sudo');
  if (isAuthFailure(data)) redirect('/login');
  return data;
});

export const getAccountSettings = () => getUserSettings('account');
