import { canEditSystem } from '@/features/manage/manage-access';
import { getUserPrivPage } from '@/features/manage/user-priv/get-user-priv-page';
import UserPrivPage from '@/features/manage/user-priv/user-priv-page';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('systemUserPriv') };
}

export default async function ManageUserPrivPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');
  const state = await getUserPrivPage();
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <UserPrivPage data={state.data} />;
}
