import ServerApis from '@/api/server/method';
import AuthStatus from '@/features/auth/auth-status';
import { resolveCodeState } from '@/features/auth/code-state';
import LostpassResetForm from '@/features/auth/lostpass/lostpass-reset-form';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';

type Params = { code: string };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('lostPassword') };
}

export default async function LostpassResetRoutePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { code } = await params;
  const t = await getTranslations('auth');

  let response;
  try {
    response = await ServerApis.Auth.getLostpassToken(code);
  } catch (error) {
    unstable_rethrow(error);
    response = { error: { name: 'Error', message: 'request failed' } };
  }
  const state = resolveCodeState(response);

  if (state.kind !== 'ready') {
    return (
      <AuthStatus
        title={t('invalidTokenTitle')}
        description={t('invalidTokenDescription')}
        actionLabel={t('requestNewLink')}
        actionHref="/lostpass"
      />
    );
  }

  return <LostpassResetForm code={code} uname={state.data.uname} />;
}
