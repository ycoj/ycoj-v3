import {
  buildSystemSettingsPayload,
  createSystemSettingsSchema,
  getSystemSettingFormValues,
  groupSystemSettingFields,
  toSystemSettingFields,
} from './setting-form-utils';
import type { SystemSettingItem } from '@/api/server/method/system/setting';
import { describe, expect, it } from 'vitest';

function setting(
  overrides: Partial<SystemSettingItem> & Pick<SystemSettingItem, 'key'>
): SystemSettingItem {
  return {
    family: 'setting_server',
    value: null,
    name: overrides.key,
    desc: null,
    flag: 0,
    type: 'text',
    range: null,
    ...overrides,
  };
}

describe('system setting field conversion', () => {
  it('derives inputs, formats, and support from backend flags', () => {
    const fields = toSystemSettingFields([
      setting({ key: 'server.name', type: 'text' }),
      setting({ key: 'smtp.pass', type: 'password', flag: 4 }),
      setting({ key: 'server.port', type: 'number' }),
      setting({ key: 'smtp.secure', type: 'boolean' }),
      setting({
        key: 'server.language',
        type: 'select',
        range: { zh: '中文', en: 'English' },
      }),
      setting({ key: 'discussion.nodes', type: 'textarea', subType: 'yaml' }),
      setting({ key: 'hydrooj.homepage', type: 'text', subType: 'yaml' }),
      setting({ key: 'hidden.setting', flag: 1 }),
      setting({ key: 'db.ver', flag: 2 }),
      setting({ key: 'deeply.nested.key' }),
      setting({ key: 'noDotKey' }),
    ]);

    expect(fields.map((field) => field.key)).toEqual([
      'server.name',
      'smtp.pass',
      'server.port',
      'smtp.secure',
      'server.language',
      'discussion.nodes',
      'hydrooj.homepage',
      'db.ver',
      'deeply.nested.key',
      'noDotKey',
    ]);
    expect(fields[1]).toMatchObject({ input: 'password', secret: true });
    expect(fields[2]).toMatchObject({ input: 'number', integer: true });
    expect(fields[3]).toMatchObject({ input: 'boolean' });
    expect(fields[4].options).toEqual([
      { value: 'zh', label: '中文' },
      { value: 'en', label: 'English' },
    ]);
    expect(fields[5]).toMatchObject({ input: 'textarea', format: 'yaml' });
    expect(fields[6]).toMatchObject({ format: 'yaml' });
    expect(fields[7]).toMatchObject({ disabled: true });
    expect(fields[8].supported).toBe(false);
    expect(fields[9].supported).toBe(false);
  });

  it('groups supported and unsupported fields by family in order', () => {
    const groups = groupSystemSettingFields(
      toSystemSettingFields([
        setting({ key: 'server.name', family: 'setting_server' }),
        setting({ key: 'unsupported.key.extra', family: 'setting_server' }),
        setting({ key: 'smtp.host', family: 'setting_smtp' }),
      ])
    );
    expect(groups.map((group) => group.family)).toEqual([
      'setting_server',
      'setting_smtp',
    ]);
    expect(groups[0].supported.map((field) => field.key)).toEqual([
      'server.name',
    ]);
    expect(groups[0].unsupported.map((field) => field.key)).toEqual([
      'unsupported.key.extra',
    ]);
  });
});

describe('system setting form values', () => {
  const fields = toSystemSettingFields([
    setting({ key: 'server.name', value: 'Hydro' }),
    setting({ key: 'smtp.pass', type: 'password', flag: 4 }),
    setting({ key: 'smtp.secure', type: 'boolean', value: false }),
    setting({ key: 'server.port', type: 'number', value: 8888 }),
    setting({ key: 'hydrooj.homepage', type: 'textarea', subType: 'yaml' }),
    setting({ key: 'db.ver', flag: 2, value: 3 }),
  ]);

  it('keeps secrets blank and prefers stored values over defaults', () => {
    const values = getSystemSettingFormValues(fields, {
      'server.name': 'YCOJ',
      'smtp.pass': 'stored-secret',
      'smtp.secure': true,
      'server.port': 80,
      'hydrooj.homepage': { sections: [] },
    });
    expect(values).toEqual({
      server: { name: 'YCOJ', port: '80' },
      smtp: { pass: '', secure: true },
      hydrooj: { homepage: '{\n  "sections": []\n}' },
      db: { ver: '3' },
    });
  });

  it('falls back to defaults and formats missing values as empty', () => {
    const values = getSystemSettingFormValues(fields, {});
    expect(values.server.name).toBe('Hydro');
    expect(values.server.port).toBe('8888');
    expect(values.smtp.secure).toBe(false);
    expect(values.smtp.pass).toBe('');
  });

  it('builds a POST body that preserves blank secrets and disables unchecked booleans', () => {
    const payload = buildSystemSettingsPayload(fields, {
      server: { name: 'YCOJ', port: '8080' },
      smtp: { pass: '', secure: false },
      hydrooj: { homepage: '{}' },
      db: { ver: '999' },
    });
    expect(payload.values).toEqual({
      server: { name: 'YCOJ', port: '8080' },
      smtp: { secure: '' },
      hydrooj: { homepage: '{}' },
    });
    expect(payload.booleanKeys).toEqual({ smtp: { secure: true } });
  });

  it('sends enabled booleans as the on token and keeps entered secrets', () => {
    const payload = buildSystemSettingsPayload(fields, {
      smtp: { pass: 'new-secret', secure: true },
    });
    expect(payload.values).toEqual({
      smtp: { secure: 'on', pass: 'new-secret' },
    });
  });
});

describe('system setting validation', () => {
  const messages = {
    invalidNumber: 'invalid number',
    invalidYaml: 'invalid yaml',
    invalidJson: 'invalid json',
  };
  const schema = createSystemSettingsSchema(
    toSystemSettingFields([
      setting({ key: 'server.port', type: 'number' }),
      setting({ key: 'discussion.nodes', type: 'textarea', subType: 'yaml' }),
      setting({ key: 'smtp.secure', type: 'boolean' }),
    ]),
    messages
  );

  it.each([
    ['8080', true],
    ['-1', true],
    ['80.5', false],
    ['abc', false],
  ])('validates integer input %s', (port, valid) => {
    const result = schema.safeParse({
      server: { port },
      discussion: { nodes: '[]' },
      smtp: { secure: false },
    });
    expect(result.success).toBe(valid);
  });

  it('reports the YAML message for an unparsable document', () => {
    const result = schema.safeParse({
      server: { port: '1' },
      discussion: { nodes: 'a: [b' },
      smtp: { secure: false },
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('invalid yaml');
    }
  });
});
