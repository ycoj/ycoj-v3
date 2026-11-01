import { getSiteBrand } from './get-brand';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), headers: vi.fn() }));
vi.mock('@/api/server/method/branding', () => ({ getBrand: mocks.get }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ unstable_rethrow: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SITE_NAME', 'Default OJ');
});
afterEach(() => vi.unstubAllEnvs());
describe('request-specific brands', () => {
  it('uses the visiting host, protocol and port without mixing brands between requests', async () => {
    for (const host of ['one.school.edu', 'two.school.edu:8443']) {
      mocks.headers.mockResolvedValue(
        new Headers({ host, 'x-forwarded-proto': 'https' })
      );
      mocks.get.mockResolvedValue({
        brand: {
          origin: `https://${host}`,
          name: host,
          logo: 'https://cdn.school.edu/logo.png',
        },
      });
      expect((await getSiteBrand()).name).toBe(host);
      expect(mocks.get).toHaveBeenLastCalledWith(`https://${host}`);
    }
  });
  it('keeps the default brand when the origin is unknown or backend is unavailable', async () => {
    mocks.headers.mockResolvedValue(
      new Headers({ host: 'unknown.school.edu', 'x-forwarded-proto': 'https' })
    );
    mocks.get.mockResolvedValue({ brand: null });
    expect(await getSiteBrand()).toEqual({ name: 'Default OJ', logo: null });
    mocks.get.mockRejectedValue(new Error('Unavailable'));
    expect(await getSiteBrand()).toEqual({ name: 'Default OJ', logo: null });
  });
});
