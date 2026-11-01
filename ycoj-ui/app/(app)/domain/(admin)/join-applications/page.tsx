import DomainJoinApplicationsPage from '@/features/domain/join-applications/domain-join-applications-page';
import {
  getDomainJoinApplicationsPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { headers } from 'next/headers';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('domainAdmin');
  return { title: t('joinPolicyTitle') };
}

export default async function DomainJoinApplicationsRoute() {
  const [viewer, t, state, headerList] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainJoinApplicationsPage(),
    headers(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  const origin = (() => {
    const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
    const proto = headerList.get('x-forwarded-proto') ?? 'https';
    if (!host) return 'https://ui.invalid/';
    return `${proto}://${host}/`;
  })();
  return (
    <DomainJoinApplicationsPage
      data={state.data}
      domainId={viewer.domainId}
      urlPrefix={state.data.url_prefix ?? origin}
    />
  );
}
