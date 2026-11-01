import RegisterRequestForm from '@/features/auth/register/register-request-form';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('register') };
}

export default function RegisterRoutePage() {
  return <RegisterRequestForm />;
}
