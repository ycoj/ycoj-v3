'use client';

import { startRegistration } from '@/api/client/method/auth/register';
import { registerStartErrorKey } from '@/features/auth/auth-errors';
import { resolveAuthLanding } from '@/features/auth/auth-landing';
import AuthShell from '@/features/auth/auth-shell';
import { hardNavigate } from '@/features/auth/navigate';
import { isValidEmail } from '@/features/auth/validation';
import { Button } from '@/shared/components/ui/button';
import { Field, FieldContent, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type Props = { mail?: string };

type FormValues = { mail: string };

export default function RegisterRequestForm({ mail }: Props) {
  const t = useTranslations('auth');
  const [sent, setSent] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { mail: mail ?? '' },
  });
  const busy = formState.isSubmitting;

  const submit = async ({ mail: value }: FormValues) => {
    const trimmed = value.trim();
    if (!isValidEmail(trimmed)) {
      setSubmitError(t('invalidEmail'));
      return;
    }
    setSubmitError(null);
    try {
      const response = await startRegistration(trimmed).send();
      if ('error' in response) {
        setSubmitError(t(registerStartErrorKey(response.error)));
        return;
      }
      if (response.url) {
        hardNavigate(resolveAuthLanding(response.url, window.location.origin));
        return;
      }
      setSent(trimmed);
    } catch {
      setSubmitError(t('retryError'));
    }
  };

  return (
    <AuthShell
      title={t('registerTitle')}
      description={t('registerDescription')}
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm" role="status" data-llm-text={sent}>
            {t('registerMailSent', { mail: sent })}
          </p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/login">{t('backToLogin')}</Link>
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit(submit)} noValidate>
          <Field>
            <FieldLabel htmlFor="mail">{t('email')}</FieldLabel>
            <FieldContent>
              <Input
                id="mail"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t('emailPlaceholder')}
                disabled={busy}
                {...register('mail')}
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
            {busy ? t('sendingEmail') : t('sendVerificationEmail')}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              {t('backToLogin')}
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
