import {
  getDomainPermissionsPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import DomainPermissionMatrix from '@/features/domain/permission/domain-permission-matrix';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainPermissions') };
}

export default async function DomainPermissionsRoute() {
  const [viewer, t, state] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainPermissionsPage(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <DomainPermissionMatrix data={state.data} />;
}
