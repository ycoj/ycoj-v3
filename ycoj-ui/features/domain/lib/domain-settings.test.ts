import {
  DOMAIN_SETTING_FLAG,
  buildDomainSettingsPayload,
  getBooleanSettingKeys,
  getSettingsFormValues,
  getSettingValue,
  getVisibleSettings,
  groupDomainSettings,
  isWideSetting,
} from './domain-settings';
import type { DomainSetting } from '@/api/server/method/domain/types';
import { describe, expect, it } from 'vitest';

const settings: DomainSetting[] = [
  {
    family: 'setting_domain',
    key: 'name',
    value: 'New domain',
    type: 'text',
    name: 'name',
    flag: 0,
  },
  {
    family: 'setting_domain',
    key: 'bulletin',
    value: '',
    type: 'markdown',
    name: 'Bulletin',
    flag: 0,
  },
  {
    family: 'setting_domain',
    key: 'feature',
    value: false,
    type: 'boolean',
    name: 'Feature',
    flag: 0,
  },
  {
    family: 'setting_storage',
    key: 'host',
    value: '',
    type: 'text',
    name: 'Custom host',
    flag: DOMAIN_SETTING_FLAG.HIDDEN | DOMAIN_SETTING_FLAG.DISABLED,
  },
  {
    family: 'setting_domain',
    key: 'secret',
    value: 'stored',
    type: 'text',
    name: 'Secret',
    flag: DOMAIN_SETTING_FLAG.SECRET,
  },
];

describe('domain settings', () => {
  it('hides storage, hidden, and disabled settings', () => {
    expect(getVisibleSettings(settings).map((setting) => setting.key)).toEqual([
      'name',
      'bulletin',
      'feature',
      'secret',
    ]);
  });

  it('renders wide editors for markdown and textarea types', () => {
    expect(isWideSetting(settings[1])).toBe(true);
    expect(isWideSetting(settings[0])).toBe(false);
  });

  it('reads secrets as blank and booleans as booleans', () => {
    expect(getSettingValue(settings[3 - 1], { feature: true })).toBe(true);
    expect(getSettingValue(settings[4], { secret: 'stored' })).toBe('');
    expect(getSettingValue(settings[0], {})).toBe('New domain');
  });

  it('builds form values for visible settings', () => {
    const visible = getVisibleSettings(settings);
    expect(
      getSettingsFormValues(visible, { name: 'School', feature: true })
    ).toEqual({
      fields: [
        { value: 'School' },
        { value: '' },
        { value: true },
        { value: '' },
      ],
    });
  });

  it('submits checked booleans only and skips blank secrets', () => {
    const visible = getVisibleSettings(settings);
    const values = getSettingsFormValues(visible, {
      name: 'School',
      bulletin: 'Hello',
      feature: false,
      secret: '',
    });
    const { payload } = buildDomainSettingsPayload(visible, values);
    expect(payload).toEqual({ name: 'School', bulletin: 'Hello' });
  });

  it('submits true for a checked boolean', () => {
    const visible = getVisibleSettings(settings);
    const values = getSettingsFormValues(visible, { feature: true });
    const { payload } = buildDomainSettingsPayload(visible, values);
    expect(payload.feature).toBe(true);
  });

  it('lists every boolean key for the unchecked-checkbox contract', () => {
    expect(getBooleanSettingKeys(settings)).toEqual(['feature']);
  });

  it('groups settings by family in declaration order', () => {
    const groups = groupDomainSettings(getVisibleSettings(settings));
    expect(groups.map((group) => group.family)).toEqual(['setting_domain']);
    expect(groups[0].settings).toHaveLength(4);
  });
});
