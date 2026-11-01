import ServerApis from '@/api/server/method';
import AuthStatus from '@/features/auth/auth-status';
import { resolveCodeState } from '@/features/auth/code-state';
import RegisterCompleteForm from '@/features/auth/register/register-complete-form';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';

type Params = { code: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('register') };
}

export default async function RegisterCompleteRoutePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { code } = await params;
  const t = await getTranslations('auth');

  let response;
  try {
    response = await ServerApis.Auth.getRegisterToken(code);
  } catch (error) {
    unstable_rethrow(error);
    response = { error: { name: 'Error', message: 'request failed' } };
  }
  const state = resolveCodeState(response);

  if (state.kind === 'invalid') {
    return (
      <AuthStatus
        title={t('invalidTokenTitle')}
        description={t('invalidTokenDescription')}
        actionLabel={t('requestNewLink')}
        actionHref="/register"
      />
    );
  }
  if (state.kind !== 'ready') {
    return (
      <AuthStatus
        title={t('registerUnavailableTitle')}
        description={t('registerUnavailable')}
        actionLabel={t('backToLogin')}
      />
    );
  }

  return (
    <RegisterCompleteForm
      code={code}
      mail={state.data.mail}
      username={state.data.username}
      lockUsername={state.data.lockUsername === true}
    />
  );
}
