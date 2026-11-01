'use client';

import { createBrandingSchema } from './branding-form-utils';
import ClientApis from '@/api/client/method';
import { Button } from '@/shared/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import type { BrandingConfig } from '@/shared/types/branding';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

export default function BrandingForm({ config }: { config: BrandingConfig }) {
  const t = useTranslations('branding');
  const router = useRouter();
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BrandingConfig>({
    defaultValues: config,
    resolver: zodResolver(
      createBrandingSchema({
        origin: t('invalidOrigin'),
        name: t('invalidName'),
        logo: t('invalidLogo'),
        duplicate: t('duplicateOrigin'),
        secureLogo: t('secureLogo'),
      })
    ),
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'brands' });
  const submit = async (next: BrandingConfig) => {
    try {
      const response =
        await ClientApis.Branding.saveBrandingConfig(next).send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      if ('config' in response) {
        reset(response.config);
        toast.success(t('saved'));
        router.refresh();
      }
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : t('saveFailed'),
      });
    }
  };
  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      aria-label={t('title')}
      aria-busy={isSubmitting}
      className="min-w-0 space-y-6"
      data-llm-visible="true"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : <Save />}
          {t('save')}
        </Button>
      </header>
      <p className="text-sm text-muted-foreground">{t('corsHint')}</p>
      <fieldset disabled={isSubmitting} className="space-y-6">
        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t('empty')}
          </p>
        )}
        {fields.map((field, index) => (
          <section
            key={field.id}
            aria-label={t('brandEntry', { index: index + 1 })}
            className="space-y-4 rounded-lg border p-4 sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-medium">
                {t('brandEntry', { index: index + 1 })}
              </h2>
              <Button
                type="button"
                variant="ghost"
                onClick={() => remove(index)}
                aria-label={t('removeBrand', { index: index + 1 })}
              >
                <Trash2 />
                {t('remove')}
              </Button>
            </div>
            {(['origin', 'name', 'logo'] as const).map((key) => {
              const error = errors.brands?.[index]?.[key];
              const id = `brand-${field.id}-${key}`;
              return (
                <Field key={key} data-invalid={!!error}>
                  <FieldLabel htmlFor={id}>{t(key)}</FieldLabel>
                  <Input
                    id={id}
                    {...register(`brands.${index}.${key}`)}
                    type={key === 'name' ? 'text' : 'url'}
                    placeholder={t(`${key}Placeholder`)}
                    aria-invalid={!!error}
                    aria-describedby={error ? `${id}-error` : undefined}
                  />
                  {error && (
                    <FieldError id={`${id}-error`}>{error.message}</FieldError>
                  )}
                </Field>
              );
            })}
          </section>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ origin: '', name: '', logo: '' })}
        >
          <Plus />
          {t('add')}
        </Button>
      </fieldset>
      {errors.root && (
        <p role="alert" className="text-sm text-destructive">
          {errors.root.message}
        </p>
      )}
    </form>
  );
}
