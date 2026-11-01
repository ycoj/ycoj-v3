import {
  JOIN_METHOD,
  JOIN_EXPIRATION_KEEP_CURRENT,
  isInvitationCode,
  parseExpirationOption,
  buildExpirationOptions,
} from './join-policy';
import {
  buildJoinSettingsPayload,
  readableExpirationOptions,
  validateJoinSettings,
} from './join-settings-form';
import { describe, expect, it } from 'vitest';

const messages = {
  codeInvalid: 'bad code',
  roleRequired: 'role required',
  expireRequired: 'expire required',
};

describe('invitation codes', () => {
  it.each([
    ['invite', true],
    ['ABC123', true],
    ['a'.repeat(64), true],
    ['a'.repeat(65), false],
    ['with space', false],
    ['code!', false],
    ['', false],
  ])('validates %j', (value, expected) => {
    expect(isInvitationCode(value)).toBe(expected);
  });
});

describe('expiration options', () => {
  it('parses keep-current, never, and hour presets', () => {
    expect(parseExpirationOption('')).toBeNull();
    expect(parseExpirationOption('-1')).toBe(-1);
    expect(parseExpirationOption('24')).toBe(24);
  });

  it('drops keep-current when no policy exists', () => {
    const expirations = { '0': 'Keep', '24': 'In 1 day', '-1': 'Never' };
    expect(buildExpirationOptions(expirations, false)).toEqual([
      { value: '24', label: 'In 1 day' },
      { value: '-1', label: 'Never' },
    ]);
    expect(buildExpirationOptions(expirations, true)).toHaveLength(3);
  });

  it('renders readable labels for hour keys', () => {
    const options = readableExpirationOptions(
      { '0': 'Keep', '24': 'In 1 day', '-1': 'Never' },
      true,
      { keep: 'Keep current', never: 'Never', hours: (n) => `${n} hours` }
    );
    expect(options).toEqual([
      { value: '0', label: 'Keep current' },
      { value: '24', label: '24 hours' },
      { value: '-1', label: 'Never' },
    ]);
  });
});

describe('join settings validation', () => {
  const base = {
    method: '1' as const,
    role: 'member',
    group: '',
    expire: '24',
    invitationCode: '',
  };

  it('allows disabling joining without a role', () => {
    expect(
      validateJoinSettings({ ...base, method: '0', role: '' }, messages, false)
    ).toBeNull();
  });

  it('requires a role whenever a policy exists', () => {
    expect(validateJoinSettings({ ...base, role: '' }, messages, false)).toBe(
      'role required'
    );
  });

  it('requires an expiry when no policy exists yet', () => {
    expect(validateJoinSettings({ ...base, expire: '' }, messages, false)).toBe(
      'expire required'
    );
    expect(
      validateJoinSettings({ ...base, expire: '' }, messages, true)
    ).toBeNull();
  });

  it('requires a valid invitation code for code mode', () => {
    expect(
      validateJoinSettings(
        { ...base, method: '2', invitationCode: 'bad code' },
        messages,
        true
      )
    ).toBe('bad code');
    expect(
      validateJoinSettings(
        { ...base, method: '2', invitationCode: 'invite' },
        messages,
        true
      )
    ).toBeNull();
  });
});

describe('join settings payload', () => {
  it('sends only the method when joining is disabled', () => {
    expect(
      buildJoinSettingsPayload({
        method: '0',
        role: 'member',
        group: 'Class',
        expire: '24',
        invitationCode: 'x',
      })
    ).toEqual({ method: JOIN_METHOD.NONE });
  });

  it('omits an empty group and keeps expiry as a number', () => {
    expect(
      buildJoinSettingsPayload({
        method: '1',
        role: 'member',
        group: '  ',
        expire: '24',
        invitationCode: '',
      })
    ).toEqual({ method: JOIN_METHOD.ALL, role: 'member', expire: 24 });
  });

  it('omits keep-current expiry and includes the invitation code', () => {
    expect(
      buildJoinSettingsPayload({
        method: '2',
        role: 'member',
        group: ' Class ',
        expire: '',
        invitationCode: 'invite',
      })
    ).toEqual({
      method: JOIN_METHOD.CODE,
      role: 'member',
      group: 'Class',
      invitationCode: 'invite',
    });
  });

  it('keeps the never-expire sentinel distinct from keep-current', () => {
    expect(
      buildJoinSettingsPayload({
        method: '1',
        role: 'member',
        group: '',
        expire: String(JOIN_EXPIRATION_KEEP_CURRENT - 1),
        invitationCode: '',
      })
    ).toMatchObject({ expire: -1 });
  });
});
