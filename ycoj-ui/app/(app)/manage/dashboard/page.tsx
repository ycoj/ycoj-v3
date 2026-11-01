import { getHomepage } from '@/api/server/method/ui/homepage';
import DashboardConsole from '@/features/manage/dashboard/dashboard-console';
import { canEditSystem } from '@/features/manage/manage-access';
import { getUser } from '@/features/user/lib/get-user';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('systemDashboard') };
}

export default async function ManageDashboardPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');

  let domainName = '';
  try {
    const homepage = await getHomepage();
    domainName =
      typeof homepage?.domain?.name === 'string' ? homepage.domain.name : '';
  } catch {
    // The console stays usable without domain details.
  }

  return <DashboardConsole domainName={domainName} />;
}
