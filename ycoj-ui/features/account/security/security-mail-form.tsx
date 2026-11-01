'use client';

import { assertSecurityResult } from './resolve-security-result';
import ClientApis from '@/api/client/method';
import SettingsSection from '@/features/account/settings/settings-section';
import { Button } from '@/shared/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck, PenLine } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type Props = { currentMail?: string };

type FormValues = { password: string; mail: string };

const emailPattern = /^[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

export default function SecurityMailForm({ currentMail }: Props) {
  const t = useTranslations('security');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(
      z.object({
        password: z.string().min(1, t('mail.passwordRequired')),
        mail: z
          .string()
          .regex(emailPattern, t('mail.invalid'))
          .refine(
            (value) => value.toLowerCase() !== currentMail?.toLowerCase(),
            t('mail.sameAsCurrent')
          ),
      })
    ),
    defaultValues: { password: '', mail: '' },
  });

  const submit = async (values: FormValues) => {
    try {
      const response = await ClientApis.Account.changeMail(
        values.password,
        values.mail.trim()
      ).send();
      if (assertSecurityResult(response) === 'sudo') return;
      reset();
      setSentTo(values.mail.trim());
    } catch (error) {
      setError('root', {
        message:
          error instanceof Error && error.message
            ? error.message
            : t('actionFailed'),
      });
    }
  };

  if (sentTo) {
    return (
      <SettingsSection id="security-mail" title={t('mail.title')}>
        <div
          className="flex max-w-md items-start gap-3 rounded-xl bg-muted/40 p-4 ring-1 ring-foreground/10"
          role="status"
          data-llm-visible="true"
        >
          <MailCheck
            className="mt-0.5 size-5 shrink-0 text-primary"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <p
              className="text-sm font-medium"
              data-llm-text={t('mail.sentTitle')}
            >
              {t('mail.sentTitle')}
            </p>
            <p
              className="text-sm text-muted-foreground"
              data-llm-text={t('mail.sentDescription', { mail: sentTo })}
            >
              {t('mail.sentDescription', { mail: sentTo })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-3"
          onClick={() => setSentTo(null)}
        >
          <PenLine aria-hidden="true" />
          {t('mail.sendAnother')}
        </Button>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection id="security-mail" title={t('mail.title')}>
      <form
        onSubmit={handleSubmit(submit)}
        aria-label={t('mail.title')}
        data-llm-visible="true"
        noValidate
      >
        <FieldGroup className="max-w-md gap-4">
          <Field>
            <FieldLabel htmlFor="security-current-mail">
              {t('mail.current')}
            </FieldLabel>
            <Input
              id="security-current-mail"
              type="email"
              value={currentMail ?? ''}
              readOnly
              disabled
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="security-new-mail">{t('mail.new')}</FieldLabel>
            <Input
              id="security-new-mail"
              type="email"
              autoComplete="email"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.mail)}
              {...register('mail')}
            />
            <FieldError errors={[errors.mail]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="security-mail-password">
              {t('mail.password')}
            </FieldLabel>
            <Input
              id="security-mail-password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <FieldDescription className="text-xs">
              {t('mail.help')}
            </FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <FieldError errors={[errors.root]} />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('saving') : t('mail.submit')}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </SettingsSection>
  );
}
