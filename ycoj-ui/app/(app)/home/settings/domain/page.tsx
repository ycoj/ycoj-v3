import DomainSettingsPage from '@/features/account/settings/domain-settings-page';
import { getUserSettings } from '@/features/account/settings/get-account-settings';
import Errored from '@/shared/components/errored/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('preference') };
}

export default async function DomainSettingsRoute() {
  const data = await getUserSettings('domain');
  if ('error' in data) return <Errored error={data.error} />;
  if (!('settings' in data)) return null;
  return <DomainSettingsPage data={data} />;
}
