import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
} from 'next/constants';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/next-intl.config', () => ({ default: (config: unknown) => config }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadConfig(phase: string) {
  const { default: createNextConfig } = await import('@/next.config');
  return createNextConfig(phase);
}

describe('ASSET_PREFIX', () => {
  it('prefixes production assets and keeps workers and the image optimizer on the origin', async () => {
    vi.stubEnv('ASSET_PREFIX', 'https://next-cdn.ycoj.cc/');
    const config = await loadConfig(PHASE_PRODUCTION_BUILD);
    expect(config.assetPrefix).toBe('https://next-cdn.ycoj.cc');
    expect(config.env?.ASSET_PREFIX).toBe('https://next-cdn.ycoj.cc');
    expect(config.experimental?.turbopackWorkerAssetPrefix).toBe('');
    expect(config.images?.path).toBeUndefined();
  });

  it('keeps an empty prefix on the site origin', async () => {
    vi.stubEnv('ASSET_PREFIX', '');
    const config = await loadConfig(PHASE_PRODUCTION_BUILD);
    expect(config.assetPrefix).toBe('');
    expect(config.env?.ASSET_PREFIX).toBe('');
  });

  it('ignores the prefix in the development server', async () => {
    vi.stubEnv('ASSET_PREFIX', 'https://next-cdn.ycoj.cc');
    const config = await loadConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config.assetPrefix).toBe('');
    expect(config.env?.ASSET_PREFIX).toBe('');
  });

  it('allows the CDN to serve VelociTex modules, WASM, styles, and fonts', async () => {
    const config = await loadConfig(PHASE_PRODUCTION_BUILD);
    const headers = await config.headers?.();
    expect(
      headers?.find((rule) => rule.source === '/velocitex/:path*')?.headers
    ).toEqual(
      expect.arrayContaining([
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ])
    );
  });
});
