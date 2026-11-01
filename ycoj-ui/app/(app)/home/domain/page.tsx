import ServerApis from '@/api/server/method';
import MyDomainsPage from '@/features/domain/list/my-domains-page';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import 'server-only';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('myDomains') };
}

const getMyDomainsPayload = cache(async () => {
  const [data, user, current] = await Promise.all([
    ServerApis.Domain.getMyDomains(),
    getUser(),
    ServerApis.Domain.getCurrentDomain(),
  ]);
  return { data, user, current };
});

export default async function MyDomainsRoute() {
  const [t, errorT] = await Promise.all([
    getTranslations('domain'),
    getTranslations('error'),
  ]);
  const { data, user, current } = await getMyDomainsPayload();
  if (!user?._id) return <Errored error={errorT('unavailable')} />;
  if (!data || !Array.isArray(data.ddocs))
    return <Errored error={t('loadFailed')} />;
  const activeDomainId =
    'domain' in current && current.domain?._id ? current.domain._id : 'system';
  return (
    <MyDomainsPage
      data={data}
      userId={user._id}
      activeDomainId={activeDomainId}
      canCreate={hasPriv(user, PRIV.PRIV_CREATE_DOMAIN)}
      canJoin={hasPriv(user, PRIV.PRIV_USER_PROFILE)}
    />
  );
}
