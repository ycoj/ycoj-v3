import ServerApis from '@/api/server/method';
import ChangeMailResult from '@/features/account/security/change-mail-result';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';

type Params = { code: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('security') };
}

export default async function ChangeMailRoute({
  params,
}: {
  params: Promise<Params>;
}) {
  const { code } = await params;
  const user = await getUser();
  const t = await getTranslations('security');
  if (!user?._id || !hasPriv(user, PRIV.PRIV_USER_PROFILE))
    redirect(
      `/login?redirect=${encodeURIComponent(`/home/changeMail/${code}`)}`
    );

  let success = true;
  let errorMessage: string | undefined;
  try {
    const response = await ServerApis.Account.confirmChangeMail(code);
    if (isSudoRequired(response)) redirect('/user/sudo');
    throwBackendError(response);
  } catch (error) {
    unstable_rethrow(error);
    success = false;
    errorMessage =
      error instanceof BackendResponseError && error.message
        ? error.message
        : t('mail.confirmFailedDescription');
  }

  return <ChangeMailResult success={success} errorMessage={errorMessage} />;
}
