'use client';

import AvatarSettings from './avatar-settings';
import SettingsForm from './settings-form';
import SettingsLayout from './settings-layout';
import {
  SETTING_FLAG,
  type AccountSettingsData,
} from '@/shared/types/account-settings';
import { useTranslations } from 'next-intl';

type Props = { data: AccountSettingsData };

export default function AccountSettingsPage({ data }: Props) {
  const t = useTranslations('accountSettings');
  const avatar = data.settings.find((setting) => setting.key === 'avatar');

  return (
    <SettingsLayout title={t('title')} description={t('description')}>
      {!(avatar && avatar.flag & SETTING_FLAG.HIDDEN) && (
        <AvatarSettings
          current={data.current}
          disabled={Boolean(avatar && avatar.flag & SETTING_FLAG.DISABLED)}
        />
      )}
      <SettingsForm
        data={data}
        category="account"
        namespace="accountSettings"
      />
    </SettingsLayout>
  );
}
