'use client';

import LoginChallenge from './login-challenge';
import LoginProviders from './login-providers';
import { resolveLoginRedirect } from './resolve-login-redirect';
import {
  buildLoginPayload,
  readTfaMethods,
  requiredChallenge,
  type LoginAttempt,
  type LoginCredential,
  type TfaMethods,
} from './tfa-bridge';
import ClientApis from '@/api/client/method';
import { loginErrorKey } from '@/features/auth/auth-errors';
import AuthShell from '@/features/auth/auth-shell';
import { hardNavigate } from '@/features/auth/navigate';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { throwBackendError } from '@/shared/lib/backend-response';
import type { LoginProvider } from '@/shared/types/auth';
import type { HydroError } from '@/shared/types/error';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

type LoginFormValues = {
  uname: string;
  password: string;
  rememberme: boolean;
};

type Props = { providers?: LoginProvider[]; builtInLogin?: boolean };

type ChallengeState = {
  attempt: LoginAttempt;
  methods: TfaMethods;
  verifying: boolean;
  error: string | null;
};

function responseUrl(response: unknown) {
  const url =
    response && typeof response === 'object' && 'url' in response
      ? (response as { url?: unknown }).url
      : undefined;
  return typeof url === 'string' && url ? url : null;
}

export function LoginPage({ providers = [], builtInLogin = true }: Props) {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);

  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    defaultValues: {
      uname: '',
      password: '',
      rememberme: false,
    },
  });

  const redirect = searchParams?.get('redirect') ?? undefined;
  const errorMessage = (error: HydroError) => t(loginErrorKey(error));

  const startChallenge = async (attempt: LoginAttempt) => {
    let methods: TfaMethods = { tfa: true, authn: false };
    try {
      const parsed = readTfaMethods(
        await ClientApis.Auth.getTfaMethods(attempt.uname).send()
      );
      if (parsed && (parsed.tfa || parsed.authn)) methods = parsed;
    } catch {
      // Keep the most common factor when the probe fails; the backend still
      // verifies whatever credential is finally submitted.
    }
    setChallenge({ attempt, methods, verifying: false, error: null });
  };

  const onSubmit = async (values: LoginFormValues) => {
    setSubmitError(null);
    const attempt: LoginAttempt = {
      ...values,
      redirect: resolveLoginRedirect(
        document.referrer,
        window.location.origin,
        searchParams?.get('redirect')
      ),
    };

    try {
      const response = await ClientApis.Auth.login(attempt).send();
      const url = responseUrl(response);
      if (url) {
        hardNavigate(url);
        return;
      }

      if ('error' in response) {
        const error = response.error as HydroError;
        if (requiredChallenge(error)) {
          await startChallenge(attempt);
          return;
        }
        throw new Error(errorMessage(error));
      }

      throw new Error(t('retryError'));
    } catch (error) {
      setSubmitError(
        error instanceof Error && error.message
          ? error.message
          : t('retryError')
      );
    }
  };

  const verifyFactor = async (credential: LoginCredential) => {
    if (!challenge) return;
    setChallenge({ ...challenge, verifying: true, error: null });
    try {
      const response = await ClientApis.Auth.login(
        buildLoginPayload(challenge.attempt, credential)
      ).send();
      const url = responseUrl(response);
      if (url) {
        hardNavigate(url);
        return;
      }
      let message = t('tfaFailed');
      if ('error' in response) {
        // The backend's message names the rejected factor, which is the only
        // actionable detail here; fall back when it cannot be read.
        try {
          throwBackendError(response);
        } catch (backendError) {
          if (backendError instanceof Error && backendError.message)
            message = backendError.message;
        }
      }
      setChallenge((current) =>
        current ? { ...current, verifying: false, error: message } : current
      );
    } catch (error) {
      setChallenge((current) =>
        current
          ? {
              ...current,
              verifying: false,
              error:
                error instanceof Error && error.message
                  ? error.message
                  : t('tfaFailed'),
            }
          : current
      );
    }
  };

  if (challenge) {
    return (
      <AuthShell title={t('tfaTitle')} description={t('tfaDescription')}>
        <LoginChallenge
          uname={challenge.attempt.uname}
          tfa={challenge.methods.tfa}
          authn={challenge.methods.authn}
          submitting={challenge.verifying}
          error={challenge.error}
          onVerify={verifyFactor}
          onCancel={() => {
            setChallenge(null);
            setSubmitError(null);
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t('loginTitle')}
      description={t('loginDescription', {
        siteName: process.env.SITE_NAME ?? '',
      })}
      footer={
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <Link href="/lostpass" className="hover:text-foreground">
            {t('forgotPassword')}
          </Link>
          <Link href="/register" className="hover:text-foreground">
            {t('createAccount')}
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {builtInLogin ? (
          <form
            className="space-y-4"
            onSubmit={handleSubmit(onSubmit)}
            noValidate
          >
            <Field>
              <FieldLabel htmlFor="uname">{t('username')}</FieldLabel>
              <FieldContent>
                <Input
                  id="uname"
                  type="text"
                  autoComplete="username webauthn"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={t('usernamePlaceholder')}
                  aria-invalid={!!errors.uname}
                  disabled={isSubmitting}
                  {...register('uname', {
                    required: t('usernamePlaceholder'),
                  })}
                />
                <FieldError errors={[errors.uname]} />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
              <FieldContent>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('passwordPlaceholder')}
                  aria-invalid={!!errors.password}
                  disabled={isSubmitting}
                  {...register('password', {
                    required: t('passwordPlaceholder'),
                  })}
                />
                <FieldError errors={[errors.password]} />
              </FieldContent>
            </Field>

            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="rememberme"
                render={({ field }) => (
                  <>
                    <Checkbox
                      id="rememberme"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(!!checked)}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="rememberme" className="text-sm">
                      {t('rememberMe')}
                    </Label>
                  </>
                )}
              />
            </div>

            {submitError && (
              <p
                className="text-destructive text-sm"
                role="alert"
                data-llm-text={submitError}
              >
                {submitError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('loggingIn') : t('loginTitle')}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground" role="status">
            {t('loginDisabled')}
          </p>
        )}

        <LoginProviders providers={providers} redirect={redirect} />
      </div>
    </AuthShell>
  );
}
