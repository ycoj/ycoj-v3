import { getUserSettings } from '@/features/account/settings/get-account-settings';
import PreferenceSettingsPage from '@/features/account/settings/preference-settings-page';
import Errored from '@/shared/components/errored/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('preference') };
}

export default async function PreferenceSettingsRoute() {
  const data = await getUserSettings('preference');
  if ('error' in data) return <Errored error={data.error} />;
  if (!('settings' in data)) return null;
  return <PreferenceSettingsPage data={data} />;
}
