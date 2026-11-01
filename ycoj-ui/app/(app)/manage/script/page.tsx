import { canEditSystem } from '@/features/manage/manage-access';
import { getScriptPage } from '@/features/manage/script/get-script-page';
import ScriptRunner from '@/features/manage/script/script-runner';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('systemScript') };
}

export default async function ManageScriptPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');
  const state = await getScriptPage();
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <ScriptRunner scripts={state.scripts} />;
}
