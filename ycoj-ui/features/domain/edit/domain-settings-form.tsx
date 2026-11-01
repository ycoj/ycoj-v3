'use client';

import ClientApis from '@/api/client/method';
import type { DomainEditResponse } from '@/api/server/method/domain/types';
import {
  DOMAIN_SETTING_FLAG,
  buildDomainSettingsPayload,
  getBooleanSettingKeys,
  getSettingOptions,
  getSettingsFormValues,
  getVisibleSettings,
  groupDomainSettings,
  isWideSetting,
  type DomainSetting,
  type DomainSettingsFormValues,
} from '@/features/domain/lib/domain-settings';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import MarkdownEditor from '@/shared/components/markdown-editor';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { cn } from '@/shared/lib/utils';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = { data: DomainEditResponse };

function SettingControl({
  setting,
  value,
  disabled,
  onChange,
  label,
  secret,
}: {
  setting: DomainSetting;
  value: string | boolean;
  disabled: boolean;
  onChange: (value: string | boolean) => void;
  label: string;
  secret: boolean;
}) {
  const t = useTranslations('domainAdmin');
  const id = `domain-setting-${setting.key}`;
  const options = getSettingOptions(setting);
  const description = setting.desc ?? undefined;

  if (setting.type === 'boolean') {
    return (
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 text-sm"
      >
        <Checkbox
          id={id}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <span data-llm-text={label}>{label}</span>
      </label>
    );
  }

  if (setting.type === 'select') {
    const index = Math.max(
      0,
      options.findIndex(([option]) => option === String(value))
    );
    return (
      <Select
        value={String(index)}
        disabled={disabled}
        onValueChange={(next) => onChange(options[Number(next)]?.[0] ?? '')}
      >
        <SelectTrigger
          id={id}
          aria-label={label}
          aria-describedby={description ? `${id}-description` : undefined}
          className="h-9 w-full"
        >
          <SelectValue placeholder={t('selectPlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {options.map(([optionValue, text], optionIndex) => (
            <SelectItem key={optionValue} value={String(optionIndex)}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (setting.type === 'markdown') {
    return (
      <div role="group" aria-label={label}>
        <MarkdownEditor
          id={id}
          value={String(value)}
          disabled={disabled}
          onChange={async (event) =>
            onChange(String(event?.target?.value ?? event))
          }
        />
      </div>
    );
  }

  if (
    ['textarea', 'json', 'yaml'].includes(setting.type) ||
    setting.subType === 'yaml'
  ) {
    return (
      <Textarea
        id={id}
        value={String(value)}
        disabled={disabled}
        rows={4}
        aria-label={label}
        placeholder={secret ? t('secretUnchanged') : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 field-sizing-fixed"
      />
    );
  }

  const numeric = setting.type === 'number' || setting.type === 'float';
  return (
    <Input
      id={id}
      value={String(value)}
      disabled={disabled}
      aria-label={label}
      placeholder={secret ? t('secretUnchanged') : undefined}
      type={secret ? 'password' : numeric ? 'number' : 'text'}
      step={setting.type === 'float' ? 'any' : numeric ? 1 : undefined}
      onChange={(event) => onChange(event.target.value)}
      className="h-9"
    />
  );
}

export default function DomainSettingsForm({ data }: Props) {
  const t = useTranslations('domainAdmin');
  const router = useRouter();
  const settings = getVisibleSettings(data.settings);
  const [values, setValues] = useState<DomainSettingsFormValues>(() =>
    getSettingsFormValues(settings, data.current)
  );
  const [submitting, setSubmitting] = useState(false);

  const setValue = (index: number, value: string | boolean) => {
    setValues((current) => ({
      fields: current.fields.map((field, fieldIndex) =>
        fieldIndex === index ? { value } : field
      ),
    }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const { payload } = buildDomainSettingsPayload(settings, values);
      const target = await submitDomainMutation(
        ClientApis.Domain.saveDomainSettings(
          payload,
          getBooleanSettingKeys(settings)
        ),
        '/domain'
      );
      toast.success(t('settingsSaved'));
      router.push(target);
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('settingsFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const groups = groupDomainSettings(settings);
  const fieldIndex = new Map(
    settings.map((setting, index) => [setting.key, index])
  );

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="space-y-6"
      aria-label={t('settingsTitle')}
      data-llm-visible="true"
    >
      <h1 className="text-xl font-semibold" data-llm-text={t('settingsTitle')}>
        {t('settingsTitle')}
      </h1>
      {groups.map((group) => (
        <section key={group.family} className="space-y-4">
          <h2
            className="text-sm font-semibold"
            data-llm-text={
              t.has(`settingFamilies.${group.family}`)
                ? t(`settingFamilies.${group.family}`)
                : group.family
            }
          >
            {t.has(`settingFamilies.${group.family}`)
              ? t(`settingFamilies.${group.family}`)
              : group.family}
          </h2>
          <FieldGroup className="grid gap-4 sm:grid-cols-2">
            {group.settings.map((setting) => {
              const index = fieldIndex.get(setting.key) ?? 0;
              const label = setting.name || setting.key;
              const disabled =
                submitting ||
                Boolean(setting.flag & DOMAIN_SETTING_FLAG.DISABLED);
              const secret = Boolean(setting.flag & DOMAIN_SETTING_FLAG.SECRET);
              const value = values.fields[index]?.value ?? '';
              return (
                <Field
                  key={setting.key}
                  className={cn(isWideSetting(setting) && 'sm:col-span-2')}
                  data-disabled={disabled}
                >
                  {setting.type !== 'boolean' && (
                    <FieldLabel htmlFor={`domain-setting-${setting.key}`}>
                      {label}
                    </FieldLabel>
                  )}
                  <SettingControl
                    setting={setting}
                    value={value}
                    disabled={disabled}
                    onChange={(next) => setValue(index, next)}
                    label={label}
                    secret={secret}
                  />
                  {setting.desc && (
                    <FieldDescription
                      className="text-xs"
                      data-llm-text={setting.desc}
                    >
                      {setting.desc}
                    </FieldDescription>
                  )}
                </Field>
              );
            })}
          </FieldGroup>
        </section>
      ))}
      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {t('saveSettings')}
        </Button>
      </div>
    </form>
  );
}
