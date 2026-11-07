import { resolveLegacyRoute } from '@/shared/lib/legacy-routes';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/next-intl.config', () => ({ default: (config: unknown) => config }));

describe('problem short route', () => {
  it('redirects every legacy problem page to the problem route', () => {
    expect(resolveLegacyRoute('/p/1000')?.destination).toBe('/problem/1000');
    expect(resolveLegacyRoute('/p/1000/submit', '?tid=c1')?.destination).toBe(
      '/problem/1000/submit?tid=c1'
    );
    expect(resolveLegacyRoute('/p/1000/solution/2')?.destination).toBe(
      '/problem/1000/solution/2'
    );
  });

  it('leaves problem downloads and raw bodies on the backend', () => {
    expect(resolveLegacyRoute('/p/1000/file/a.in')).toBeNull();
    expect(resolveLegacyRoute('/p/1000/solution/2/raw')).toBeNull();
    expect(resolveLegacyRoute('/p/1000/feedback')).toBeNull();
  });

  it('is emitted by the next.config redirects', async () => {
    const { default: createNextConfig } = await import('@/next.config');
    const config = createNextConfig(PHASE_PRODUCTION_BUILD);
    const redirects = (await config.redirects?.()) ?? [];

    expect(redirects).toContainEqual({
      source: '/p',
      destination: '/problem',
      permanent: true,
    });
  });
});
