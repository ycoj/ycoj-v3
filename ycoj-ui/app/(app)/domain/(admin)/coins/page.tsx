import DomainCoinsPage from '@/features/domain/coins/domain-coins-page';
import {
  getDomainCoinsPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainCoins') };
}

export default async function DomainCoinsRoute() {
  const [viewer, t, state] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainCoinsPage(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <DomainCoinsPage data={state.data} domainId={viewer.domainId} />;
}
