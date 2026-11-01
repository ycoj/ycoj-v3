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
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

type FormValues = {
  current: string;
  password: string;
  verifyPassword: string;
};

export default function SecurityPasswordForm() {
  const t = useTranslations('security');
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(
      z
        .object({
          current: z.string().min(1, t('password.currentRequired')),
          password: z.string().min(6, t('password.tooShort')).max(255),
          verifyPassword: z.string().min(1, t('password.verifyRequired')),
        })
        .refine((values) => values.password === values.verifyPassword, {
          path: ['verifyPassword'],
          message: t('password.mismatch'),
        })
    ),
    defaultValues: { current: '', password: '', verifyPassword: '' },
  });

  const submit = async (values: FormValues) => {
    try {
      const response = await ClientApis.Account.changePassword(
        values.current,
        values.password,
        values.verifyPassword
      ).send();
      if (assertSecurityResult(response) === 'sudo') return;
      reset();
      toast.success(t('password.changed'));
      // Changing the password revokes all sessions, so return to sign-in.
      router.push('/login');
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
    <SettingsSection id="security-password" title={t('password.title')}>
      <form
        onSubmit={handleSubmit(submit)}
        aria-label={t('password.title')}
        data-llm-visible="true"
        noValidate
      >
        <FieldGroup className="max-w-md gap-4">
          <Field>
            <FieldLabel htmlFor="security-current-password">
              {t('password.current')}
            </FieldLabel>
            <Input
              id="security-current-password"
              type="password"
              autoComplete="current-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.current)}
              {...register('current')}
            />
            <FieldError errors={[errors.current]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="security-new-password">
              {t('password.new')}
            </FieldLabel>
            <Input
              id="security-new-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.password)}
              {...register('password')}
            />
            <FieldDescription className="text-xs">
              {t('password.help')}
            </FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="security-verify-password">
              {t('password.verify')}
            </FieldLabel>
            <Input
              id="security-verify-password"
              type="password"
              autoComplete="new-password"
              disabled={isSubmitting}
              aria-invalid={Boolean(errors.verifyPassword)}
              {...register('verifyPassword')}
            />
            <FieldError errors={[errors.verifyPassword]} />
          </Field>
          <FieldError errors={[errors.root]} />
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('saving') : t('password.submit')}
            </Button>
          </div>
        </FieldGroup>
      </form>
    </SettingsSection>
  );
}
