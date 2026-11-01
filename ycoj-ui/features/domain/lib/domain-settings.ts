import type { DomainSetting } from '@/api/server/method/domain/types';

export type { DomainSetting };

/** Setting flags mirrored from `packages/hydrooj/src/model/setting.ts`. */
export const DOMAIN_SETTING_FLAG = {
  HIDDEN: 1,
  DISABLED: 2,
  SECRET: 4,
  PUBLIC: 16,
  PRIVATE: 32,
} as const;

export type DomainSettingValue = string | number | boolean;

export const isHiddenSetting = (setting: DomainSetting) =>
  Boolean(setting.flag & DOMAIN_SETTING_FLAG.HIDDEN);

export const isDisabledSetting = (setting: DomainSetting) =>
  Boolean(setting.flag & DOMAIN_SETTING_FLAG.DISABLED);

export const isSecretSetting = (setting: DomainSetting) =>
  Boolean(setting.flag & DOMAIN_SETTING_FLAG.SECRET);

/** Settings rendered as a full-width editor row. */
export function isWideSetting(setting: DomainSetting) {
  return (
    ['markdown', 'textarea', 'json', 'yaml'].includes(setting.type) ||
    setting.subType === 'yaml'
  );
}

/** Hidden storage settings never appear in the editor, matching the legacy form. */
export function getVisibleSettings(settings: DomainSetting[]) {
  return settings.filter(
    (setting) =>
      !isHiddenSetting(setting) &&
      setting.family !== 'setting_storage' &&
      !isDisabledSetting(setting)
  );
}

export function getSettingOptions(setting: DomainSetting): [string, string][] {
  if (Array.isArray(setting.range)) return setting.range;
  if (setting.range && typeof setting.range === 'object')
    return Object.entries(setting.range);
  return [];
}

/** Current value formatted for the matching input type. */
export function getSettingValue(
  setting: DomainSetting,
  current: Record<string, unknown>
) {
  if (isSecretSetting(setting)) return '';
  const value = current[setting.key] ?? setting.value;
  if (setting.type === 'boolean') return Boolean(value);
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

export type DomainSettingsFormValues = {
  fields: { value: string | boolean }[];
};

export function getSettingsFormValues(
  settings: DomainSetting[],
  current: Record<string, unknown>
): DomainSettingsFormValues {
  return {
    fields: settings.map((setting) => ({
      value: getSettingValue(setting, current),
    })),
  };
}

/**
 * Builds the save payload from visible settings. Checked booleans send
 * `key: true`; the caller also lists every boolean key in `booleanKeys` so the
 * backend stores unchecked boxes as `false`. Blank secret fields are skipped so
 * the stored value is preserved.
 */
export function buildDomainSettingsPayload(
  settings: DomainSetting[],
  values: DomainSettingsFormValues
): { payload: Record<string, DomainSettingValue> } {
  const payload: Record<string, DomainSettingValue> = {};
  settings.forEach((setting, index) => {
    if (isHiddenSetting(setting) || isDisabledSetting(setting)) return;
    const value = values.fields[index]?.value;
    if (setting.type === 'boolean') {
      if (value === true) payload[setting.key] = true;
      return;
    }
    if (isSecretSetting(setting) && !value) return;
    payload[setting.key] = value as DomainSettingValue;
  });
  return { payload };
}

/** Every boolean setting key, as required by the backend checkbox contract. */
export function getBooleanSettingKeys(settings: DomainSetting[]) {
  return settings
    .filter(
      (setting) =>
        setting.type === 'boolean' &&
        !isHiddenSetting(setting) &&
        !isDisabledSetting(setting)
    )
    .map((setting) => setting.key);
}

export function groupDomainSettings(settings: DomainSetting[]) {
  const groups = new Map<string, DomainSetting[]>();
  for (const setting of settings) {
    const list = groups.get(setting.family) ?? [];
    list.push(setting);
    groups.set(setting.family, list);
  }
  return Array.from(groups, ([family, items]) => ({ family, settings: items }));
}
