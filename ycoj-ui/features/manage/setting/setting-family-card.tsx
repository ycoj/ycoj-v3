'use client';

import type { SystemSettingField } from './setting-form-utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
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
import { useTranslations } from 'next-intl';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';

type FormValues = Record<string, Record<string, string | boolean>>;

type Props = {
  family: string;
  fields: SystemSettingField[];
  unsupported: SystemSettingField[];
  control: Control<FormValues>;
  errors: FieldErrors<FormValues>;
  disabled: boolean;
};

function fieldError(
  errors: FieldErrors<FormValues>,
  field: SystemSettingField
) {
  const [family, sub] = field.key.split('.');
  const familyErrors = errors[family] as
    Record<string, { message?: string } | undefined> | undefined;
  return familyErrors?.[sub];
}

export default function SettingFamilyCard({
  family,
  fields,
  unsupported,
  control,
  errors,
  disabled,
}: Props) {
  const t = useTranslations('system');
  const familyName = t.has(`families.${family}`)
    ? t(`families.${family}`)
    : t('familyUnknown');
  return (
    <Card className="min-w-0" data-llm-visible="true">
      <CardHeader className="space-y-1 border-b">
        <h2 className="text-base font-semibold" data-llm-text={familyName}>
          {familyName}
        </h2>
        <CardDescription className="font-mono text-xs">
          {family}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <FieldGroup className="grid items-start gap-5 sm:grid-cols-2">
          {fields.map((field) => (
            <SettingField
              key={field.key}
              field={field}
              control={control}
              error={fieldError(errors, field)}
              disabled={disabled}
            />
          ))}
        </FieldGroup>
        {unsupported.length > 0 && (
          <ul className="space-y-2">
            {unsupported.map((field) => (
              <li
                key={field.key}
                className="rounded-lg border border-dashed px-3 py-2 text-sm"
              >
                <span className="font-medium">{field.label}</span>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {field.key}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('settingUnsupported')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SettingField({
  field,
  control,
  error,
  disabled,
}: {
  field: SystemSettingField;
  control: Control<FormValues>;
  error?: { message?: string };
  disabled: boolean;
}) {
  const t = useTranslations('system');
  const [family, sub] = field.key.split('.');
  const name = `${family}.${sub}`;
  const fieldDisabled = disabled || field.disabled;
  const inputId = `setting-${field.key.replaceAll('.', '-')}`;
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: controller }) => (
        <Field
          data-invalid={Boolean(error)}
          className={
            field.input === 'textarea' || field.input === 'boolean'
              ? 'sm:col-span-2'
              : undefined
          }
          data-disabled={fieldDisabled}
        >
          <FieldLabel htmlFor={inputId}>
            <span data-llm-text={field.label}>{field.label}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {field.key}
            </span>
          </FieldLabel>
          {field.input === 'boolean' ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                id={inputId}
                checked={(controller.value as unknown) === true}
                disabled={fieldDisabled}
                onCheckedChange={(checked) => controller.onChange(checked)}
                aria-label={field.label}
              />
              <span className="text-muted-foreground">
                {field.description || field.label}
              </span>
            </label>
          ) : field.input === 'select' ? (
            <Select
              value={String(controller.value ?? '')}
              disabled={fieldDisabled}
              onValueChange={controller.onChange}
            >
              <SelectTrigger id={inputId} className="w-full min-w-0">
                <SelectValue placeholder={field.label} />
              </SelectTrigger>
              <SelectContent position="popper">
                {field.options.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : field.input === 'textarea' ? (
            <Textarea
              id={inputId}
              rows={field.format ? 5 : 3}
              value={String(controller.value ?? '')}
              disabled={fieldDisabled}
              aria-invalid={Boolean(error)}
              onBlur={controller.onBlur}
              onChange={(event) => controller.onChange(event.target.value)}
              className="font-mono text-xs"
            />
          ) : (
            <Input
              id={inputId}
              type={
                field.input === 'password'
                  ? 'password'
                  : field.input === 'number'
                    ? 'number'
                    : 'text'
              }
              value={String(controller.value ?? '')}
              disabled={fieldDisabled}
              aria-invalid={Boolean(error)}
              onBlur={controller.onBlur}
              onChange={(event) => controller.onChange(event.target.value)}
            />
          )}
          {field.description && field.input !== 'boolean' && (
            <FieldDescription>{field.description}</FieldDescription>
          )}
          {field.secret && (
            <FieldDescription>{t('settingSecretHint')}</FieldDescription>
          )}
          {field.disabled && (
            <FieldDescription>{t('settingDisabled')}</FieldDescription>
          )}
          <FieldError errors={[error]} />
        </Field>
      )}
    />
  );
}
