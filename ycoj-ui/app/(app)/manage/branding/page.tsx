import BrandingForm from '@/features/manage/branding/branding-form';
import { getBrandingPage } from '@/features/manage/branding/get-branding-page';
import { canEditSystem } from '@/features/manage/manage-access';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('branding');
  return { title: t('title') };
}

export default async function BrandingPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');
  const state = await getBrandingPage();
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <BrandingForm config={state.config} />;
}
