import DomainSettingsForm from '@/features/domain/edit/domain-settings-form';
import {
  getDomainEditPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainEdit') };
}

export default async function DomainEditPage() {
  const [viewer, t, state] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainEditPage(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <DomainSettingsForm data={state.data} />;
}
