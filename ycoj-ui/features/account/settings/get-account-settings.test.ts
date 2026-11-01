import { getAccountSettings, getUserSettings } from './get-account-settings';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getSettings: vi.fn() }));
vi.mock('@/features/user/lib/get-user', () => ({ getUser: mocks.getUser }));
vi.mock('@/api/server/method', () => ({
  default: { Account: { getUserSettings: mocks.getSettings } },
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ _id: 2, priv: 4 });
});

describe('user settings access', () => {
  it.each([
    { _id: 0, priv: 0 },
    { _id: 2, priv: 0 },
  ])('redirects guests and users without profile privileges', async (user) => {
    mocks.getUser.mockResolvedValue(user);
    await expect(getUserSettings('account')).rejects.toThrow('redirect:/login');
    expect(mocks.getSettings).not.toHaveBeenCalled();
  });

  it.each(['account', 'preference', 'domain'] as const)(
    'loads the authenticated %s data from its category endpoint',
    async (category) => {
      const data = { category, current: { _id: 2 }, settings: [] };
      mocks.getSettings.mockResolvedValue(data);
      await expect(getUserSettings(category)).resolves.toEqual(data);
      expect(mocks.getSettings).toHaveBeenCalledWith(category);
    }
  );

  it('loads the account category through the compatibility alias', async () => {
    const data = { category: 'account', current: { _id: 2 }, settings: [] };
    mocks.getSettings.mockResolvedValue(data);
    await expect(getAccountSettings()).resolves.toEqual(data);
    expect(mocks.getSettings).toHaveBeenCalledWith('account');
  });

  it.each([
    { url: '/login' },
    { error: { name: 'PrivilegeError', message: 'Denied' } },
  ])('handles backend authentication failures', async (response) => {
    mocks.getSettings.mockResolvedValue(response);
    await expect(getUserSettings('account')).rejects.toThrow('redirect:/login');
  });

  it.each(['/user/sudo', '/d/system/user/sudo'])(
    'routes sudo-protected settings through the shared confirmation flow: %s',
    async (url) => {
      mocks.getSettings.mockResolvedValue({ url });
      await expect(getUserSettings('preference')).rejects.toThrow(
        'redirect:/user/sudo'
      );
    }
  );

  it('returns other error payloads so the route can render them', async () => {
    const response = { error: { name: 'ValidationError', message: 'Bad' } };
    mocks.getSettings.mockResolvedValue(response);
    await expect(getUserSettings('domain')).resolves.toEqual(response);
  });
});
