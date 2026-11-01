import type { MyDomainsResponse } from './types';
import { alova } from '@/api/server';

type MyDomainsBody = Omit<MyDomainsResponse, 'pinnedDomains'>;

type AccountSettingsBody = {
  current?: { pinnedDomains?: unknown };
};

/**
 * Loads the caller's joined domains plus the account-level star list.
 * `pinnedDomains` is only exposed through the private user view served with
 * the settings page, so the starred state comes from there rather than from
 * `/home/domain`, which omits it for public users.
 */
export const getMyDomains = async (): Promise<MyDomainsResponse> => {
  const [body, settings] = await Promise.all([
    alova.Get<MyDomainsBody>('/home/domain'),
    alova.Get<AccountSettingsBody>('/home/settings/account'),
  ]);
  const pinned = settings.current?.pinnedDomains;
  return {
    ...body,
    pinnedDomains: Array.isArray(pinned)
      ? pinned.filter((value): value is string => typeof value === 'string')
      : [],
  };
};
