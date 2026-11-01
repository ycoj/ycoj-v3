import { alova } from '@/api/server';
import type {
  AccountSettingsData,
  UserSettingsCategory,
} from '@/shared/types/account-settings';
import type { Errorable } from '@/shared/types/error';

export type AccountSettingsResponse =
  Errorable<AccountSettingsData> | { url: string };

export const getUserSettings = (category: UserSettingsCategory) =>
  alova.Get<AccountSettingsResponse>(
    `/home/settings/${encodeURIComponent(category)}`
  );

export const getAccountSettings = () => getUserSettings('account');
