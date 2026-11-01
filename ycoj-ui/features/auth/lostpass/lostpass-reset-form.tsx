'use client';

import { resetPassword } from '@/api/client/method/auth/lostpass';
import { lostpassCompleteErrorKey } from '@/features/auth/auth-errors';
import { resolveAuthLanding } from '@/features/auth/auth-landing';
import AuthShell from '@/features/auth/auth-shell';
import { hardNavigate } from '@/features/auth/navigate';
import { PASSWORD_MIN_LENGTH } from '@/features/auth/validation';
import { Button } from '@/shared/components/ui/button';
import { Field, FieldContent, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type Props = { code: string; uname?: string };

type FormValues = { password: string; verifyPassword: string };

export default function LostpassResetForm({ code, uname }: Props) {
  const t = useTranslations('auth');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { password: '', verifyPassword: '' },
  });
  const busy = formState.isSubmitting;

  const submit = async ({ password, verifyPassword }: FormValues) => {
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
      const response = await resetPassword({
        code,
        password,
        verifyPassword,
      }).send();
      if ('error' in response) {
        setSubmitError(t(lostpassCompleteErrorKey(response.error)));
        return;
      }
      if (response.url) {
        hardNavigate(resolveAuthLanding(response.url, window.location.origin));
        return;
      }
      setDone(true);
    } catch {
      setSubmitError(t('retryError'));
    }
  };

  return (
    <AuthShell
      title={t('resetPasswordTitle')}
      description={t('resetPasswordDescription', { uname: uname ?? '' })}
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-sm" role="status">
            {t('resetPasswordSuccess')}
          </p>
          <Button asChild className="w-full">
            <Link href="/login">{t('backToLogin')}</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <Field>
            <FieldLabel htmlFor="password">{t('password')}</FieldLabel>
            <FieldContent>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                autoFocus
                disabled={busy}
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
            {busy && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {busy ? t('resettingPassword') : t('resetPasswordSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
