import CreateDomainForm from '@/features/domain/create/create-domain-form';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('problemCreateDomain') };
}

export default async function CreateDomainRoute() {
  const t = await getTranslations('domain');
  const user = await getUser();
  if (!user?._id) redirect('/login');
  if (!hasPriv(user, PRIV.PRIV_CREATE_DOMAIN))
    return <Errored error={t('createFailed')} />;
  return <CreateDomainForm />;
}
