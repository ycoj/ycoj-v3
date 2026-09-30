import AiProviderForm from '@/features/manage/ai-provider/ai-provider-form';
import { getAiProviderPage } from '@/features/manage/ai-provider/get-ai-provider-page';
import { canEditSystem } from '@/features/manage/manage-access';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aiProvider');
  return { title: t('title') };
}

export default async function AiProviderPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');
  const state = await getAiProviderPage();
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <AiProviderForm config={state.config} />;
}
