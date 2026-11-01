import {
  authenticatorShortId,
  credentialIdBase64,
  generateTotpSecret,
  otpauthUri,
  sessionBrowserLabel,
  sessionIpLabel,
  sessionLocationLabel,
  sessionOsLabel,
  sortSessions,
} from './security-utils';
import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

describe('credentialIdBase64', () => {
  it.each([
    ['plain string', 'abc123', 'abc123'],
    ['direct base64 object', { base64: 'xyz789' }, 'xyz789'],
    [
      'BSON binary JSON',
      { $binary: { base64: 'BSONVALUE', subType: '00' } },
      'BSONVALUE',
    ],
  ])('reads %s', (_label, input, expected) => {
    expect(credentialIdBase64(input)).toBe(expected);
  });

  it.each([undefined, null, 42, {}, { base64: 1 }, { $binary: {} }])(
    'returns an empty string for unusable values: %o',
    (input) => {
      expect(credentialIdBase64(input)).toBe('');
    }
  );

  it('truncates the credential id to a short, recognizable suffix', () => {
    expect(authenticatorShortId({ base64: 'abcdefghij' })).toBe('abcdef');
  });
});

describe('session labels', () => {
  const session = {
    _id: 'digest',
    updateIp: '203.0.113.8',
    createIp: '198.51.100.1',
    updateGeoip: { display: 'Asia China Beijing' },
    updateUaInfo: {
      browser: { name: 'Firefox', version: '128' },
      os: { name: 'Linux', version: '6.5' },
    },
  };

  it('combines browser and operating-system names with their versions', () => {
    expect(sessionBrowserLabel(session)).toBe('Firefox 128');
    expect(sessionOsLabel(session)).toBe('Linux 6.5');
  });

  it('falls back to the creation IP and trims geo-location text', () => {
    expect(sessionIpLabel(session)).toBe('203.0.113.8');
    expect(sessionIpLabel({ _id: 'x', createIp: '198.51.100.1' })).toBe(
      '198.51.100.1'
    );
    expect(sessionLocationLabel(session)).toBe('Asia China Beijing');
  });

  it('returns empty strings instead of placeholders for missing data', () => {
    expect(sessionBrowserLabel({ _id: 'x' })).toBe('');
    expect(sessionLocationLabel({ _id: 'x' })).toBe('');
    expect(sessionIpLabel({ _id: 'x' })).toBe('');
  });
});

describe('sortSessions', () => {
  it('puts the current session first, then the most recently used', () => {
    const ordered = sortSessions([
      { _id: 'old', updateAt: '2026-01-01T00:00:00.000Z' },
      { _id: 'current', isCurrent: true, updateAt: '2025-01-01T00:00:00.000Z' },
      { _id: 'new', updateAt: '2026-06-01T00:00:00.000Z' },
    ]);
    expect(ordered.map((session) => session._id)).toEqual([
      'current',
      'new',
      'old',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [{ _id: 'a' }, { _id: 'b' }];
    sortSessions(input);
    expect(input.map((session) => session._id)).toEqual(['a', 'b']);
  });
});

describe('generateTotpSecret', () => {
  it('produces a base32 secret of the requested length', () => {
    vi.stubGlobal('crypto', webcrypto);
    const secret = generateTotpSecret();
    expect(secret).toHaveLength(13);
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    vi.unstubAllGlobals();
  });

  it('builds a scannable otpauth URI', () => {
    expect(otpauthUri('alice', 'ABCDEF2345672')).toBe(
      'otpauth://totp/Hydro%3Aalice?secret=ABCDEF2345672&issuer=Hydro'
    );
  });
});
