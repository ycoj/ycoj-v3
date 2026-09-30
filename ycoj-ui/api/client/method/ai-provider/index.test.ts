import { saveAiProviderConfig } from '.';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.unstubAllGlobals());

it('saves the configuration in the legacy value field with credentials and JSON negotiation', async () => {
  const config: AiProviderConfig = { version: 1, providers: [] };
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ url: '/manage/ai-provider' }))
    );
  vi.stubGlobal('fetch', fetchMock);
  await saveAiProviderConfig(config).send();
  const [url, request] = fetchMock.mock.calls[0];
  expect(url).toBe('/api/manage/ai-provider');
  expect(request.credentials).toBe('include');
  expect(request.headers.Accept).toBe('application/json');
  expect(JSON.parse(request.body)).toEqual({ value: JSON.stringify(config) });
});
