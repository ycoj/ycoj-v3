import type { SystemSettingItem } from '@/api/server/method/system/setting';
import { load as loadYaml } from 'js-yaml';
import { z } from 'zod';

export const SYSTEM_SETTING_FLAG = {
  hidden: 1,
  disabled: 2,
  secret: 4,
} as const;

export type SystemSettingOption = { value: string; label: string };

export type SystemSettingInput =
  'text' | 'textarea' | 'password' | 'number' | 'boolean' | 'select';

/**
 * A rendered system setting. `supported` is false when the backend settings
 * POST cannot address the key: it only walks `group.key` pairs, so keys with
 * zero or multiple dots cannot be saved through this endpoint.
 */
export type SystemSettingField = {
  key: string;
  family: string;
  label: string;
  description?: string;
  input: SystemSettingInput;
  /** Number inputs must be integral unless the backend owns a float setting. */
  integer: boolean;
  format: 'yaml' | 'json' | null;
  secret: boolean;
  disabled: boolean;
  options: SystemSettingOption[];
  defaultValue: unknown;
  supported: boolean;
};

export type SystemSettingFormValues = Record<
  string,
  Record<string, string | boolean>
>;

export type SystemSettingValidationMessages = {
  invalidNumber: string;
  invalidYaml: string;
  invalidJson: string;
};

export function isSupportedSettingKey(key: string) {
  return key.split('.').length === 2;
}

function normalizeOptions(range: SystemSettingItem['range']) {
  if (!range) return [];
  if (Array.isArray(range)) {
    return range.map(([value, label]) => ({ value: String(value), label }));
  }
  return Object.entries(range).map(([value, label]) => ({
    value,
    label: String(label),
  }));
}

function toInput(setting: SystemSettingItem, secret: boolean) {
  if (secret) return 'password' as const;
  switch (setting.type) {
    case 'boolean':
      return 'boolean' as const;
    case 'number':
    case 'float':
      return 'number' as const;
    case 'password':
      return 'password' as const;
    case 'select':
    case 'radio':
    case 'image_radio':
      return 'select' as const;
    case 'textarea':
    case 'markdown':
    case 'json':
      return 'textarea' as const;
    default:
      return setting.subType === 'yaml'
        ? ('textarea' as const)
        : ('text' as const);
  }
}

function toFormat(setting: SystemSettingItem) {
  if (setting.subType === 'yaml' || setting.type === 'yaml') return 'yaml';
  if (setting.type === 'json') return 'json';
  return null;
}

export function toSystemSettingFields(
  settings: SystemSettingItem[]
): SystemSettingField[] {
  return settings
    .filter((setting) => (setting.flag & SYSTEM_SETTING_FLAG.hidden) === 0)
    .map((setting) => {
      const secret = (setting.flag & SYSTEM_SETTING_FLAG.secret) !== 0;
      return {
        key: setting.key,
        family: setting.family,
        label: setting.name || setting.key,
        description: setting.desc || undefined,
        input: toInput(setting, secret),
        integer: setting.type !== 'float',
        format: toFormat(setting),
        secret,
        disabled: (setting.flag & SYSTEM_SETTING_FLAG.disabled) !== 0,
        options: normalizeOptions(setting.range),
        defaultValue: setting.value,
        supported: isSupportedSettingKey(setting.key),
      };
    });
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'bigint') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function assignValue(
  target: SystemSettingFormValues,
  key: string,
  value: string | boolean
) {
  const [family, ...rest] = key.split('.');
  target[family] ||= {};
  target[family][rest.join('.')] = value;
}

/**
 * Builds nested form defaults from the backend settings/current snapshot.
 * Secret settings always start blank so stored secrets are never rendered.
 */
export function getSystemSettingFormValues(
  fields: SystemSettingField[],
  current: Record<string, unknown>
): SystemSettingFormValues {
  const values: SystemSettingFormValues = {};
  for (const field of fields) {
    if (!field.supported) continue;
    const stored = current[field.key];
    if (field.input === 'boolean') {
      assignValue(
        values,
        field.key,
        stored === undefined || stored === null
          ? Boolean(field.defaultValue)
          : Boolean(stored)
      );
      continue;
    }
    if (field.secret) {
      assignValue(values, field.key, '');
      continue;
    }
    assignValue(
      values,
      field.key,
      stringValue(
        stored === undefined || stored === null ? field.defaultValue : stored
      )
    );
  }
  return values;
}

function isIntegerText(value: string) {
  return /^[+-]?\d+$/.test(value.trim()) && Number.isSafeInteger(+value);
}

function isFloatText(value: string) {
  return value.trim() !== '' && Number.isFinite(+value);
}

function isYamlText(value: string) {
  try {
    loadYaml(value);
    return true;
  } catch {
    return false;
  }
}

function isJsonText(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds a nested Zod schema matching the form field names. RHF treats dotted
 * names as nested paths, so the schema mirrors `family.key` nesting.
 */
export function createSystemSettingsSchema(
  fields: SystemSettingField[],
  messages: SystemSettingValidationMessages
): z.ZodType<SystemSettingFormValues> {
  const families: Record<string, z.ZodTypeAny> = {};
  const keys: Record<string, Record<string, z.ZodTypeAny>> = {};

  for (const field of fields) {
    if (!field.supported) continue;
    const [family, sub] = field.key.split('.');
    keys[family] ||= {};
    if (field.input === 'boolean') {
      keys[family][sub] = z.boolean();
      continue;
    }
    if (field.input === 'number') {
      keys[family][sub] = z
        .string()
        .refine(
          field.integer ? isIntegerText : isFloatText,
          messages.invalidNumber
        );
      continue;
    }
    if (field.format === 'yaml') {
      keys[family][sub] = z.string().refine(isYamlText, messages.invalidYaml);
      continue;
    }
    if (field.format === 'json') {
      keys[family][sub] = z.string().refine(isJsonText, messages.invalidJson);
      continue;
    }
    keys[family][sub] = z.string();
  }

  for (const [family, entries] of Object.entries(keys)) {
    families[family] = z.object(entries);
  }

  return z.object(families) as unknown as z.ZodType<SystemSettingFormValues>;
}

export type SystemSettingsPayload = {
  values: Record<string, Record<string, string>>;
  booleanKeys: Record<string, Record<string, true>>;
};

/**
 * Converts validated form values to the POST /manage/setting body.
 * Booleans travel as `'on'` because the backend only treats that exact string
 * as true; empty secrets are omitted so stored values are preserved.
 */
export function buildSystemSettingsPayload(
  fields: SystemSettingField[],
  formValues: SystemSettingFormValues
): SystemSettingsPayload {
  const values: Record<string, Record<string, string>> = {};
  const booleanKeys: Record<string, Record<string, true>> = {};

  const assign = (key: string, value: string) => {
    const [family, sub] = key.split('.');
    values[family] ||= {};
    values[family][sub] = value;
  };

  for (const field of fields) {
    if (!field.supported || field.disabled) continue;
    const [family, sub] = field.key.split('.');
    const raw = formValues[family]?.[sub];

    if (field.input === 'boolean') {
      assign(field.key, raw === true ? 'on' : '');
      booleanKeys[family] ||= {};
      booleanKeys[family][sub] = true;
      continue;
    }

    if (typeof raw !== 'string') continue;
    if (field.secret && raw === '') continue;
    assign(field.key, raw);
  }

  return { values, booleanKeys };
}

/** True when a draft differs from the values loaded for this form. */
export function hasSettingChanges(
  fields: SystemSettingField[],
  initial: SystemSettingFormValues,
  next: SystemSettingFormValues
) {
  return fields.some((field) => {
    if (!field.supported) return false;
    const [family, sub] = field.key.split('.');
    return initial[family]?.[sub] !== next[family]?.[sub];
  });
}

/** Groups fields by family, preserving backend order, for rendering. */
export function groupSystemSettingFields(fields: SystemSettingField[]) {
  const groups: Array<{
    family: string;
    supported: SystemSettingField[];
    unsupported: SystemSettingField[];
  }> = [];
  for (const field of fields) {
    let group = groups.find((item) => item.family === field.family);
    if (!group) {
      group = { family: field.family, supported: [], unsupported: [] };
      groups.push(group);
    }
    (field.supported ? group.supported : group.unsupported).push(field);
  }
  return groups;
}
