'use client';

import { completeRegistration } from '@/api/client/method/auth/register';
import { registerCompleteErrorKey } from '@/features/auth/auth-errors';
import { resolveAuthLanding } from '@/features/auth/auth-landing';
import AuthShell from '@/features/auth/auth-shell';
import { hardNavigate } from '@/features/auth/navigate';
import {
  isValidUsername,
  PASSWORD_MIN_LENGTH,
} from '@/features/auth/validation';
import { Button } from '@/shared/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type Props = {
  code: string;
  mail?: string;
  username?: string;
  lockUsername: boolean;
};

type FormValues = {
  uname: string;
  password: string;
  verifyPassword: string;
};

export default function RegisterCompleteForm({
  code,
  mail,
  username,
  lockUsername,
}: Props) {
  const t = useTranslations('auth');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { uname: username ?? '', password: '', verifyPassword: '' },
  });
  const busy = formState.isSubmitting;

  const submit = async ({ uname, password, verifyPassword }: FormValues) => {
    const trimmed = uname.trim();
    if (!lockUsername && !isValidUsername(trimmed)) {
      setSubmitError(t('usernameInvalid'));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setSubmitError(t('passwordTooShort', { count: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (password !== verifyPassword) {
      setSubmitError(t('passwordMismatch'));
      return;
    }
    setSubmitError(null);
    try {
      const response = await completeRegistration({
        code,
        password,
        verifyPassword,
        // The server ignores this value for providers that lock usernames.
        ...(lockUsername ? {} : { uname: trimmed }),
      }).send();
      if ('error' in response) {
        setSubmitError(t(registerCompleteErrorKey(response.error)));
        return;
      }
      if (response.url) {
        hardNavigate(resolveAuthLanding(response.url, window.location.origin));
      }
    } catch {
      setSubmitError(t('retryError'));
    }
  };

  return (
    <AuthShell
      title={t('completeRegistrationTitle')}
      description={t('completeRegistrationDescription', { mail: mail ?? '' })}
    >
      <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
        {mail && (
          <Field>
            <FieldLabel htmlFor="email-readonly">{t('email')}</FieldLabel>
            <FieldContent>
              <Input id="email-readonly" type="email" value={mail} disabled />
            </FieldContent>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="uname">{t('username')}</FieldLabel>
          <FieldContent>
            <Input
              id="uname"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              readOnly={lockUsername}
              aria-readonly={lockUsername}
              disabled={busy}
              autoFocus={!lockUsername}
              {...register('uname')}
            />
            {lockUsername && (
              <FieldDescription data-llm-text={t('usernameLocked')}>
                {t('usernameLocked')}
              </FieldDescription>
            )}
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
          <FieldContent>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              disabled={busy}
              autoFocus={lockUsername}
              {...register('password')}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="verifyPassword">
            {t('repeatPassword')}
          </FieldLabel>
          <FieldContent>
            <Input
              id="verifyPassword"
              type="password"
              autoComplete="new-password"
              disabled={busy}
              {...register('verifyPassword')}
            />
          </FieldContent>
        </Field>

        {submitError && (
          <p className="text-destructive text-sm" role="alert">
            {submitError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden="true" />}
          {busy ? t('creatingAccount') : t('createAccountSubmit')}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="hover:text-foreground">
            {t('backToLogin')}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
