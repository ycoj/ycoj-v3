'use client';

import { requestPasswordReset } from '@/api/client/method/auth/lostpass';
import { lostpassStartErrorKey } from '@/features/auth/auth-errors';
import AuthShell from '@/features/auth/auth-shell';
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

export default function LostpassRequestForm({ mail }: Props) {
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');
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
      const response = await requestPasswordReset(trimmed).send();
      if ('error' in response) {
        setSubmitError(t(lostpassStartErrorKey(response.error)));
        return;
      }
      setSent(trimmed);
    } catch {
      setSubmitError(t('retryError'));
    }
  };

  return (
    <AuthShell
      title={t('lostPasswordTitle')}
      description={t('lostPasswordDescription')}
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm" role="status" data-llm-text={sent}>
            {t('lostPasswordMailSent', { mail: sent })}
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
            {t('sendResetEmail')}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground">
              {tCommon('back')}
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
