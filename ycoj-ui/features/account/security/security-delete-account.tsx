'use client';

import { assertSecurityResult } from './resolve-security-result';
import ClientApis from '@/api/client/method';
import SettingsSection from '@/features/account/settings/settings-section';
import { Button } from '@/shared/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type Props = { onRequested: () => void };

type FormValues = { password: string };

export default function SecurityDeleteAccount({ onRequested }: Props) {
  const t = useTranslations('security');
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { password: '' } });

  const submit = async ({ password }: FormValues) => {
    if (!password) {
      setError('password', { message: t('deletion.passwordRequired') });
      return;
    }
    try {
      const response =
        await ClientApis.Account.requestAccountDeletion(password).send();
      if (assertSecurityResult(response) === 'sudo') return;
      reset();
      setOpen(false);
      onRequested();
    } catch (error) {
      setError('root', {
        message:
          error instanceof Error && error.message
            ? error.message
            : t('actionFailed'),
      });
    }
  };

  return (
    <SettingsSection id="security-delete" title={t('deletion.title')}>
      <div
        className="flex max-w-2xl flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        data-llm-visible="true"
      >
        <p
          className="text-sm text-muted-foreground"
          data-llm-text={t('deletion.description')}
        >
          {t('deletion.description')}
        </p>
        <Dialog.Root
          open={open}
          onOpenChange={(next) => {
            if (isSubmitting) return;
            setOpen(next);
          }}
        >
          <Dialog.Trigger asChild>
            <Button type="button" variant="destructive">
              <Trash2 aria-hidden="true" />
              {t('deletion.request')}
            </Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
            <Dialog.Content
              className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-lg"
              data-llm-visible="true"
            >
              <Dialog.Title
                className="text-lg font-semibold"
                data-llm-text={t('deletion.confirmTitle')}
              >
                {t('deletion.confirmTitle')}
              </Dialog.Title>
              <Dialog.Description
                className="mt-2 text-sm text-muted-foreground"
                data-llm-text={t('deletion.confirmDescription')}
              >
                {t('deletion.confirmDescription')}
              </Dialog.Description>
              <form
                onSubmit={handleSubmit(submit)}
                className="mt-4 space-y-4"
                aria-label={t('deletion.confirmTitle')}
                noValidate
              >
                <Field>
                  <FieldLabel htmlFor="security-delete-password">
                    {t('deletion.password')}
                  </FieldLabel>
                  <Input
                    id="security-delete-password"
                    type="password"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    aria-invalid={Boolean(errors.password)}
                    {...register('password')}
                  />
                  <FieldDescription className="text-xs">
                    {t('deletion.passwordHelp')}
                  </FieldDescription>
                  <FieldError errors={[errors.password]} />
                </Field>
                <FieldError errors={[errors.root]} />
                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isSubmitting}
                    >
                      {t('cancel')}
                    </Button>
                  </Dialog.Close>
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? t('saving') : t('deletion.confirm')}
                  </Button>
                </div>
              </form>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </SettingsSection>
  );
}
