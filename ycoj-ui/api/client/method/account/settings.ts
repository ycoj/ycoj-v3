import { clientRequest, uploadClientRequest } from '@/api/client';
import type {
  AccountSettingValue,
  AvatarProvider,
  UserSettingsCategory,
} from '@/shared/types/account-settings';
import type { Errorable } from '@/shared/types/error';

export type AccountMutationResponse = Errorable<{ url: string }>;

/**
 * The legacy settings handler treats a boolean as enabled only when the value
 * is exactly `on`; unchecked boxes must be sent as `false`.
 */
export const encodeSettingValue = (value: AccountSettingValue) =>
  value === true ? 'on' : value;

export const saveUserSettings = (
  category: UserSettingsCategory,
  values: Record<string, AccountSettingValue>
) =>
  clientRequest.Post<AccountMutationResponse>(
    `/home/settings/${encodeURIComponent(category)}`,
    {
      ...Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          key,
          encodeSettingValue(value),
        ])
      ),
      category,
    }
  );

export const saveAccountSettings = (
  values: Record<string, AccountSettingValue>
) => saveUserSettings('account', values);

export const updateAvatar = (provider: AvatarProvider, identifier: string) =>
  clientRequest.Post<AccountMutationResponse>('/home/avatar', {
    avatar: `${provider}:${identifier.trim()}`,
  });

export const uploadAvatar = (file: File) => {
  const data = new FormData();
  data.append('file', file);
  return uploadClientRequest.Post<AccountMutationResponse>(
    '/home/avatar',
    data
  );
};
