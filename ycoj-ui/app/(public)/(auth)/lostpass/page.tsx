import LostpassRequestForm from '@/features/auth/lostpass/lostpass-request-form';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('lostPassword') };
}

export default function LostpassRoutePage() {
  return <LostpassRequestForm />;
}
