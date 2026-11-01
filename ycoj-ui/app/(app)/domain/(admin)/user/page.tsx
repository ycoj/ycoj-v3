import {
  getDomainUsersPage,
  getDomainViewer,
} from '@/features/domain/lib/get-domain-page';
import DomainMembersPage from '@/features/domain/user/domain-members-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('domainMembers') };
}

export default async function DomainMembersRoute() {
  const [viewer, t, state] = await Promise.all([
    getDomainViewer(),
    getTranslations('domainAdmin'),
    getDomainUsersPage(),
  ]);
  if (!viewer.canManage) return <Errored error={t('noPermission')} />;
  if (state.kind === 'error') return <Errored error={state.message} />;
  return (
    <DomainMembersPage
      data={state.data}
      domainId={viewer.domainId}
      ownerId={state.data.domain.owner}
      viewerId={viewer.id}
      canForceJoin={viewer.canForceJoin}
    />
  );
}
