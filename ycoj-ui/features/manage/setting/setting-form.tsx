'use client';

import SettingFamilyCard from './setting-family-card';
import {
  buildSystemSettingsPayload,
  createSystemSettingsSchema,
  getSystemSettingFormValues,
  groupSystemSettingFields,
  toSystemSettingFields,
  type SystemSettingField,
  type SystemSettingFormValues,
} from './setting-form-utils';
import { saveSystemSettings } from '@/api/client/method/system/setting';
import type { SystemSettingsResponse } from '@/api/server/method/system/setting';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { FieldError } from '@/shared/components/ui/field';
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Save, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

type Props = { data: SystemSettingsResponse };

export default function SettingForm({ data }: Props) {
  const t = useTranslations('system');
  const router = useRouter();
  const [saved, setSaved] = useState(() =>
    getSystemSettingFormValues(
      toSystemSettingFields(data.settings),
      data.current
    )
  );

  const fields = useMemo(
    () => toSystemSettingFields(data.settings),
    [data.settings]
  );
  const groups = useMemo(() => groupSystemSettingFields(fields), [fields]);
  const schema = useMemo(
    () =>
      createSystemSettingsSchema(fields, {
        invalidNumber: t('settingInvalidNumber'),
        invalidYaml: t('settingInvalidYaml'),
        invalidJson: t('settingInvalidJson'),
      }),
    [fields, t]
  );

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SystemSettingFormValues>({
    defaultValues: saved,
    resolver: zodResolver(schema),
  });

  const submit = async (values: SystemSettingFormValues) => {
    const payload = buildSystemSettingsPayload(fields, values);
    try {
      const response = await saveSystemSettings(
        payload.values,
        payload.booleanKeys
      ).send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      const next = getSystemSettingFormValues(fields, {
        ...data.current,
        ...sanitizeDraft(fields, values),
      });
      setSaved(next);
      reset(next);
      toast.success(t('settingSaved'));
      router.refresh();
    } catch (error) {
      if (error instanceof SudoRedirectError) return;
      setError('root', {
        message: error instanceof Error ? error.message : t('saveFailed'),
      });
    }
  };

  if (!fields.length) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>{t('settingEmpty')}</EmptyTitle>
          <EmptyDescription>{t('settingsDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="min-w-0 space-y-6"
      aria-label={t('settingsTitle')}
      aria-busy={isSubmitting}
      data-llm-visible="true"
    >
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          data-llm-text={t('settingsTitle')}
        >
          <Settings className="size-5" aria-hidden="true" />
          {t('settingsTitle')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('settingsDescription')}
        </p>
      </header>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
        {groups.map((group) => (
          <SettingFamilyCard
            key={group.family}
            family={group.family}
            fields={group.supported}
            unsupported={group.unsupported}
            control={control}
            errors={errors}
            disabled={isSubmitting}
          />
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border/60 pt-5">
        <FieldError errors={[errors.root]} />
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {isSubmitting ? t('settingSaving') : t('settingSave')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Projects edited form values back onto setting keys so the post-save form
 * state shows what the server stored without a full re-fetch. Blank secret
 * fields are skipped so the previously stored value is not overwritten.
 */
function sanitizeDraft(
  fields: SystemSettingField[],
  values: SystemSettingFormValues
) {
  const next: Record<string, unknown> = {};
  for (const field of fields) {
    if (!field.supported) continue;
    const [family, sub] = field.key.split('.');
    const raw = values[family]?.[sub];
    if (raw === undefined) continue;
    if (field.secret && raw === '') continue;
    next[field.key] = raw === 'on' ? true : raw;
  }
  return next;
}
