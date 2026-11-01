import DomainGroupsPage from '@/features/domain/group/domain-groups-page';
import {
  getDomainGroupsPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainGroups') };
}

export default async function DomainGroupsRoute() {
  const [viewer, t, state] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainGroupsPage(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <DomainGroupsPage data={state.data} domainId={viewer.domainId} />;
}
