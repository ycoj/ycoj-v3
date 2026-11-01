import AccountDeletionPendingPage from '@/features/account/security/account-deletion-pending-page';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('security') };
}

export default function AccountDeletionPendingRoute() {
  return <AccountDeletionPendingPage />;
}
