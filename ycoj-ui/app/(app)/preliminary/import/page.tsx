import PreliminaryImport from '@/features/preliminary/create/preliminary-import';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('preliminary');
  return { title: t('importObjective') };
}

export default async function PreliminaryImportPage() {
  const user = await getUser();
  if (!hasPerm(user, PERM.PERM_CREATE_PROBLEM)) redirect('/preliminary');
  return <PreliminaryImport />;
}
