import AiProviderPage from './page';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  load: vi.fn(),
  redirect: vi.fn(),
}));
vi.mock('@/features/user/lib/get-user', () => ({ getUser: mocks.user }));
vi.mock('@/features/manage/ai-provider/get-ai-provider-page', () => ({
  getAiProviderPage: mocks.load,
}));
vi.mock('@/features/manage/ai-provider/ai-provider-form', () => ({
  default: () => null,
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

describe('AI provider settings access', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error('redirect');
    });
    mocks.load.mockResolvedValue({
      kind: 'data',
      config: { version: 1, providers: [] },
    });
  });
  it.each([0, 4])(
    'rejects non-administrators (%s) before fetching settings',
    async (priv) => {
      mocks.user.mockResolvedValue({ priv });
      await expect(AiProviderPage()).rejects.toThrow('redirect');
      expect(mocks.redirect).toHaveBeenCalledWith('/home');
      expect(mocks.load).not.toHaveBeenCalled();
    }
  );
  it.each([-1, 5])('loads settings for system editors (%s)', async (priv) => {
    mocks.user.mockResolvedValue({ priv });
    expect(await AiProviderPage()).toBeTruthy();
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
