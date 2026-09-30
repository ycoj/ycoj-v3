import { getAiProviderPage } from './get-ai-provider-page';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ Cookie: 'sid=admin-session' }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
  unstable_rethrow: (error: Error) => {
    if (error.message.startsWith('redirect:')) throw error;
  },
}));

afterEach(() => vi.unstubAllGlobals());

describe('AI provider settings loading', () => {
  it('reads the legacy JSON config response with the admin cookie and JSON negotiation', async () => {
    const config = { version: 1, providers: [] };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ config: JSON.stringify(config) }))
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(getAiProviderPage()).resolves.toEqual({
      kind: 'data',
      config,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/manage/ai-provider');
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      Cookie: 'sid=admin-session',
      Accept: 'application/json',
    });
  });
  it('preserves the sudo redirect before exposing configuration', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ url: '/user/sudo' })))
    );
    await expect(getAiProviderPage()).rejects.toThrow('redirect:/user/sudo');
  });
  it('shows backend errors as a recoverable page error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { message: 'Permission denied' } })
          )
        )
    );
    await expect(getAiProviderPage()).resolves.toEqual({
      kind: 'error',
      message: 'Permission denied',
    });
  });
  it('shows a load error for malformed configuration', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ config: 'invalid-json' }))
        )
    );
    await expect(getAiProviderPage()).resolves.toEqual({
      kind: 'error',
      message: 'loadFailed',
    });
  });
});
