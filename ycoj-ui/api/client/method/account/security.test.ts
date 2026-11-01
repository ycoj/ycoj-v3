import { requestAccountDeletion } from './delete-account';
import {
  changeMail,
  changePassword,
  deleteAllSessions,
  deleteSession,
  disableTfa,
  disableWebauthn,
  enableTfa,
  enableWebauthn,
  startWebauthnRegistration,
} from './security';
import { saveUserSettings } from './settings';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function capture() {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ url: '/home/security' })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function postBody(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, config] = fetchMock.mock.calls[0];
  return { url, body: JSON.parse(config.body) };
}

describe('security operations', () => {
  it.each([
    [
      'change password',
      () => changePassword('old', 'new-secret', 'new-secret'),
      {
        operation: 'changePassword',
        current: 'old',
        password: 'new-secret',
        verifyPassword: 'new-secret',
      },
    ],
    [
      'change email',
      () => changeMail('secret', 'new@example.test'),
      { operation: 'changeMail', password: 'secret', mail: 'new@example.test' },
    ],
    [
      'sign out one session',
      () => deleteSession('digest'),
      { operation: 'deleteToken', tokenDigest: 'digest' },
    ],
    [
      'sign out all sessions',
      () => deleteAllSessions(),
      { operation: 'deleteAllTokens' },
    ],
    ['disable TOTP', () => disableTfa(), { operation: 'disableTfa' }],
    [
      'enable TOTP',
      () => enableTfa('123456', 'SECRET'),
      { operation: 'enableTfa', code: '123456', secret: 'SECRET' },
    ],
    [
      'start WebAuthn registration',
      () => startWebauthnRegistration('platform'),
      { operation: 'register', type: 'platform' },
    ],
    [
      'enable a WebAuthn key',
      () =>
        enableWebauthn('Laptop', {
          id: 'credential',
          rawId: 'credential',
          response: {},
          type: 'public-key',
          clientExtensionResults: {},
        } as never),
      {
        operation: 'enableAuthn',
        name: 'Laptop',
        result: {
          id: 'credential',
          rawId: 'credential',
          response: {},
          type: 'public-key',
          clientExtensionResults: {},
        },
      },
    ],
    [
      'disable a WebAuthn key',
      () => disableWebauthn('credential'),
      { operation: 'disableAuthn', id: 'credential' },
    ],
  ])('posts the expected payload for %s', async (_label, call, expected) => {
    const fetchMock = capture();
    await call().send();
    const { url, body } = postBody(fetchMock);
    expect(url).toBe('/api/home/security');
    expect(body).toEqual(expected);
  });
});

describe('account deletion', () => {
  it('posts only the confirmation password to the delete endpoint', async () => {
    const fetchMock = capture();
    await requestAccountDeletion('secret').send();
    const { url, body } = postBody(fetchMock);
    expect(url).toBe('/api/user/delete');
    expect(body).toEqual({ password: 'secret' });
  });
});

describe('category settings', () => {
  it.each(['preference', 'domain'] as const)(
    'encodes booleans for the legacy %s handler',
    async (category) => {
      const fetchMock = capture();
      await saveUserSettings(category, {
        timeZone: 'UTC',
        enabled: true,
        hidden: false,
      }).send();
      const { url, body } = postBody(fetchMock);
      expect(url).toBe(`/api/home/settings/${category}`);
      expect(body).toEqual({
        category,
        timeZone: 'UTC',
        enabled: 'on',
        hidden: false,
      });
    }
  );
});
