import DomainBulletin from '@/features/domain/bulletin';
import DomainDashboard from '@/features/domain/dashboard/domain-dashboard';
import {
  getDomainDashboardPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainDashboard') };
}

export default async function DomainConsolePage() {
  const [viewer, t, state] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainDashboardPage(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  return (
    <DomainDashboard
      data={state.data}
      canDelete={state.data.domain.owner === viewer.id}
      isSystemDomain={state.data.domain._id === 'system'}
      bulletin={
        state.data.domain.bulletin ? (
          <DomainBulletin content={state.data.domain.bulletin} />
        ) : undefined
      }
    />
  );
}
