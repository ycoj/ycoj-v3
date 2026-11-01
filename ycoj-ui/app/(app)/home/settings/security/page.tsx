import ServerApis from '@/api/server/method';
import SecuritySettingsPage from '@/features/account/security/security-settings-page';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import Errored from '@/shared/components/errored/errored';
import { isSudoRequired } from '@/shared/lib/backend-response';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('security') };
}

export default async function SecuritySettingsRoute() {
  const user = await getUser();
  if (!user?._id || !hasPriv(user, PRIV.PRIV_USER_PROFILE)) redirect('/login');

  let data;
  try {
    data = await ServerApis.Account.getSecuritySettings();
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Errored
        title={(await getTranslations('security'))('title')}
        error={error instanceof Error ? error.message : 'Error'}
      />
    );
  }
  if (isSudoRequired(data)) redirect('/user/sudo');
  if ('error' in data) {
    const t = await getTranslations('security');
    return <Errored title={t('title')} error={data.error} />;
  }
  if (!('sessions' in data)) redirect('/login');

  return (
    <SecuritySettingsPage
      uname={user.uname}
      mail={user.mail}
      tfaEnabled={Boolean(user.tfa)}
      authenticators={data.authenticators ?? []}
      sessions={data.sessions}
      geoipProvider={data.geoipProvider}
      deletionPending={Boolean(user.del)}
    />
  );
}
