'use client';

import ClientApis from '@/api/client/method';
import {
  buildCreateDomainPayload,
  validateCreateDomain,
  type CreateDomainErrors,
  type CreateDomainValues,
} from '@/features/domain/lib/create-domain';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import { Button } from '@/shared/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const EMPTY: CreateDomainValues = {
  id: '',
  name: '',
  bulletin: '',
  avatar: '',
};

export default function CreateDomainForm() {
  const t = useTranslations('domain');
  const router = useRouter();
  const [values, setValues] = useState<CreateDomainValues>(EMPTY);
  const [errors, setErrors] = useState<CreateDomainErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof CreateDomainValues, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const nextErrors = validateCreateDomain(values, {
      invalidId: t('invalidDomainId'),
      invalidName: t('invalidName'),
      invalidBulletin: t('invalidBulletin'),
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const target = await submitDomainMutation(
        ClientApis.Domain.createDomain(buildCreateDomainPayload(values)),
        '/home/domain'
      );
      toast.success(t('createSuccess'));
      router.push(target);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto w-full max-w-2xl space-y-6"
      data-llm-visible="true"
      noValidate
    >
      <header className="space-y-2">
        <h1 className="text-xl font-semibold" data-llm-text={t('createTitle')}>
          {t('createTitle')}
        </h1>
        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p data-llm-text={t('createIntro')}>{t('createIntro')}</p>
        </div>
      </header>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="create-domain-id">{t('createId')}</FieldLabel>
          <Input
            id="create-domain-id"
            name="id"
            autoFocus
            required
            value={values.id}
            aria-invalid={!!errors.id}
            aria-describedby={errors.id ? 'create-domain-id-error' : undefined}
            onChange={(event) => update('id', event.target.value)}
          />
          {errors.id && (
            <FieldError id="create-domain-id-error" data-llm-text={errors.id}>
              {errors.id}
            </FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="create-domain-name">
            {t('createName')}
          </FieldLabel>
          <Input
            id="create-domain-name"
            name="name"
            required
            value={values.name}
            aria-invalid={!!errors.name}
            onChange={(event) => update('name', event.target.value)}
          />
          {errors.name && (
            <FieldError data-llm-text={errors.name}>{errors.name}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="create-domain-bulletin">
            {t('createBulletin')}
          </FieldLabel>
          <Textarea
            id="create-domain-bulletin"
            name="bulletin"
            required
            rows={5}
            placeholder={t('createBulletinPlaceholder')}
            value={values.bulletin}
            aria-invalid={!!errors.bulletin}
            onChange={(event) => update('bulletin', event.target.value)}
          />
          {errors.bulletin && (
            <FieldError data-llm-text={errors.bulletin}>
              {errors.bulletin}
            </FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="create-domain-avatar">
            {t('createAvatar')}
          </FieldLabel>
          <Input
            id="create-domain-avatar"
            name="avatar"
            value={values.avatar}
            onChange={(event) => update('avatar', event.target.value)}
          />
          <FieldDescription data-llm-text={t('createAvatarHint')}>
            {t('createAvatarHint')}
          </FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex justify-end gap-2">
        <Button asChild variant="outline" type="button">
          <Link href="/home/domain">{t('backToMyDomains')}</Link>
        </Button>
        <Button type="submit" disabled={submitting}>
          {t('createSubmit')}
        </Button>
      </div>
    </form>
  );
}
