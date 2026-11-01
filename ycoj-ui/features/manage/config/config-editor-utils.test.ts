import { validateSystemConfig } from './config-editor-utils';
import { describe, expect, it } from 'vitest';

const schema = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        port: { type: 'number' },
      },
    },
  },
} as const;

describe('system config validation', () => {
  it('accepts YAML that matches the schema', () => {
    expect(
      validateSystemConfig('server:\n  name: YCOJ\n  port: 80\n', schema)
    ).toEqual({ kind: 'valid' });
  });

  it.each([
    ['malformed YAML', 'server: ['],
    ['a non-mapping document', '- one\n- two\n'],
    ['a schema violation', 'server:\n  port: "eighty"\n'],
  ])('rejects %s', (_label, source) => {
    const result = validateSystemConfig(source, schema);
    expect(result.kind).toBe('invalid');
    if (result.kind === 'invalid') expect(result.message).toBeTruthy();
  });

  it('validates a draft that keeps the [hidden] secret placeholder', () => {
    const secretSchema = {
      type: 'object',
      properties: {
        smtp: {
          type: 'object',
          properties: { pass: { type: 'string' } },
        },
      },
    } as const;
    const original = 'smtp:\n  pass: stored-secret\n';
    const draft = 'smtp:\n  pass: [hidden]\n';
    expect(validateSystemConfig(draft, secretSchema, original)).toEqual({
      kind: 'valid',
    });
  });
});
