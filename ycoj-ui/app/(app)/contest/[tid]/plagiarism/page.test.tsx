import Page from './page';
import { PERM } from '@/features/user/lib/priv';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ data: vi.fn(), user: vi.fn() }));
vi.mock('@/features/contest/management/get-contest-management', () => ({
  getContestManagement: mocks.data,
}));
vi.mock('@/features/user/lib/get-user', () => ({ getUser: mocks.user }));
vi.mock('@/features/contest/management/contest-management-page', () => ({
  default: () => null,
}));
vi.mock('@/shared/components/errored', () => ({ Errored: () => null }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.data.mockResolvedValue({ tdoc: { owner: 1 }, owner_udoc: { _id: 1 } });
});

describe('contest plagiarism access', () => {
  it.each([
    { _id: 0, perm: `BigInt::${PERM.PERM_EDIT_CONTEST}`, priv: 0 },
    { _id: 2, perm: `BigInt::${PERM.PERM_EDIT_CONTEST_SELF}`, priv: 0 },
    { _id: 1, perm: 'BigInt::0', priv: 0 },
  ])('denies users who cannot manage the contest', async (user) => {
    mocks.user.mockResolvedValue(user);
    const page = await Page({ params: Promise.resolve({ tid: 'contest' }) });
    expect(page.props).toMatchObject({
      title: 'unavailable',
      error: 'unavailable',
    });
  });

  it.each([
    { _id: 1, perm: `BigInt::${PERM.PERM_EDIT_CONTEST_SELF}`, priv: 0 },
    { _id: 2, perm: `BigInt::${PERM.PERM_EDIT_CONTEST}`, priv: 0 },
  ])('allows users who can manage the contest', async (user) => {
    mocks.user.mockResolvedValue(user);
    const page = await Page({ params: Promise.resolve({ tid: 'contest' }) });
    expect(page.props).toMatchObject({ mode: 'plagiarism', tid: 'contest' });
  });

  it('shows a backend failure without exposing the comparison screen', async () => {
    mocks.data.mockResolvedValue({ error: 'Contest not found' });
    mocks.user.mockResolvedValue({ _id: 1, perm: 'BigInt::0', priv: 0 });
    const page = await Page({ params: Promise.resolve({ tid: 'missing' }) });
    expect(page.props).toMatchObject({ error: 'Contest not found' });
  });
});
