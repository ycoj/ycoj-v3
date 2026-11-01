import { canEditSystem } from '@/features/manage/manage-access';
import { getSettingPage } from '@/features/manage/setting/get-setting-page';
import SettingForm from '@/features/manage/setting/setting-form';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('systemSetting') };
}

export default async function ManageSettingPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');
  const state = await getSettingPage();
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <SettingForm data={state.data} />;
}
