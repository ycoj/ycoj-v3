import ServerApis from '@/api/server/method';
import { isAuthPageAvailable } from '@/features/auth/auth-page-availability';
import { LoginPage } from '@/features/auth/login/login-page';
import type { LoginProvider } from '@/shared/types/auth';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { unstable_rethrow } from 'next/navigation';
import { Suspense } from 'react';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('login') };
}

type LoginPagePayload = {
  providers: LoginProvider[];
  builtInLogin: boolean;
};

async function readLoginPage(): Promise<LoginPagePayload> {
  const fallback: LoginPagePayload = { providers: [], builtInLogin: true };
  try {
    const data = await ServerApis.Auth.getLoginPage();
    if (!isAuthPageAvailable(data)) return fallback;
    const payload = data as {
      loginMethods?: unknown;
      builtInLogin?: unknown;
    };
    return {
      providers: Array.isArray(payload.loginMethods)
        ? (payload.loginMethods as LoginProvider[])
        : [],
      builtInLogin: payload.builtInLogin !== false,
    };
  } catch (error) {
    unstable_rethrow(error);
    return fallback;
  }
}

export default async function LoginRoutePage() {
  const { providers, builtInLogin } = await readLoginPage();
  return (
    <Suspense fallback={null}>
      <LoginPage providers={providers} builtInLogin={builtInLogin} />
    </Suspense>
  );
}
