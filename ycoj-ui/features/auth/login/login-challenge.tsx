'use client';

import type { LoginCredential } from './tfa-bridge';
import { requestWebauthnAssertion } from '@/features/auth/webauthn';
import { Button } from '@/shared/components/ui/button';
import { Field, FieldContent, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { KeyRound, LoaderCircle, Smartphone, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type Props = {
  uname: string;
  tfa: boolean;
  authn: boolean;
  submitting: boolean;
  error: string | null;
  onVerify: (credential: LoginCredential) => Promise<void>;
  onCancel: () => void;
};

type CodeForm = { code: string };

/**
 * Second sign-in step for accounts with two-step verification. Offers an
 * authenticator code when enabled and a security key assertion when the
 * account registered one.
 */
export default function LoginChallenge({
  uname,
  tfa,
  authn,
  submitting,
  error,
  onVerify,
  onCancel,
}: Props) {
  const t = useTranslations('auth');
  const [useKey, setUseKey] = useState(!tfa && authn);
  const [keyBusy, setKeyBusy] = useState(false);
  const { register, handleSubmit, setError, clearErrors, formState } =
    useForm<CodeForm>({
      defaultValues: { code: '' },
    });
  const bothAvailable = tfa && authn;
  const showKey = authn && (useKey || !tfa);
  const busy = submitting || keyBusy;
  const codeError = formState.errors.code?.message;
  const shownError = error ?? formState.errors.root?.message;

  const submitCode = async ({ code }: CodeForm) => {
    const trimmed = code.trim();
    if (!/^\d{6}$/.test(trimmed)) {
      setError('code', { message: t('tfaCodeInvalid') });
      return;
    }
    await onVerify({ tfa: trimmed });
  };

  const submitKey = async () => {
    if (keyBusy) return;
    setKeyBusy(true);
    clearErrors('root');
    try {
      await onVerify({
        authnChallenge: await requestWebauthnAssertion(
          uname,
          t('webauthnUnsupported')
        ),
      });
    } catch (failure) {
      setError('root', {
        message:
          failure instanceof Error && failure.message
            ? failure.message
            : t('webauthnFailed'),
      });
    } finally {
      setKeyBusy(false);
    }
  };

  if (!tfa && !authn) {
    return (
      <div className="space-y-4">
        <p className="text-destructive text-sm" role="alert">
          {t('tfaFailed')}
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onCancel}
        >
          <X aria-hidden="true" />
          {t('cancel')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bothAvailable && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('tfaTitle')}
        >
          <Button
            type="button"
            variant={!useKey ? 'default' : 'outline'}
            aria-pressed={!useKey}
            disabled={busy}
            onClick={() => setUseKey(false)}
          >
            <Smartphone aria-hidden="true" />
            {t('tfaUseCode')}
          </Button>
          <Button
            type="button"
            variant={useKey ? 'default' : 'outline'}
            aria-pressed={useKey}
            disabled={busy}
            onClick={() => setUseKey(true)}
          >
            <KeyRound aria-hidden="true" />
            {t('tfaUseAuthenticator')}
          </Button>
        </div>
      )}

      {showKey ? (
        <Button
          type="button"
          className="w-full"
          disabled={busy}
          onClick={() => void submitKey()}
        >
          {keyBusy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <KeyRound aria-hidden="true" />
          )}
          {t('tfaUseAuthenticator')}
        </Button>
      ) : (
        <form
          className="space-y-4"
          onSubmit={handleSubmit(submitCode)}
          noValidate
        >
          <Field>
            <FieldLabel htmlFor="tfa-code">{t('tfaCode')}</FieldLabel>
            <FieldContent>
              <Input
                id="tfa-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                disabled={busy}
                aria-invalid={!!codeError}
                placeholder="000000"
                {...register('code')}
              />
              {codeError && (
                <p role="alert" className="text-destructive text-sm">
                  {codeError}
                </p>
              )}
            </FieldContent>
          </Field>

          <Button type="submit" className="w-full" disabled={busy}>
            {submitting && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {submitting ? t('tfaVerifying') : t('tfaVerify')}
          </Button>
        </form>
      )}

      {shownError && (
        <p
          role="alert"
          className="text-destructive text-sm"
          data-llm-text={shownError}
        >
          {shownError}
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={submitting}
        onClick={onCancel}
      >
        <X aria-hidden="true" />
        {t('cancel')}
      </Button>
    </div>
  );
}
