import { render, waitFor } from '@testing-library/react';
import { version } from 'velocitex/package.json';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
});

it('renders formulas with modules, WASM, styles, and fonts from the configured CDN', async () => {
  const cdn = new URL(location.origin);
  cdn.hostname = 'cdn.localhost';
  vi.stubEnv('ASSET_PREFIX', cdn.origin);
  performance.clearResourceTimings();

  const { loadVelocitex } = await import('./velocitex');
  const renderer = await loadVelocitex();
  const { container } = render(
    <div
      dangerouslySetInnerHTML={{
        __html: await renderer.renderToString(String.raw`\frac{a}{b} + x^2`),
      }}
    />
  );
  expect(container.querySelector('.katex-html')).toBeVisible();
  expect(container.querySelector('.katex-html')).toHaveTextContent('a');
  expect(container.querySelector('.katex-html')).toHaveTextContent('x2');
  await document.fonts.ready;
  expect(
    [...document.fonts].some(
      (font) => font.family === 'KaTeX_Main' && font.status === 'loaded'
    )
  ).toBe(true);

  await waitFor(() => {
    const resources = performance
      .getEntriesByType('resource')
      .map((entry) => new URL(entry.name))
      .filter((url) => url.pathname.startsWith(`/velocitex/${version}/`));
    expect(resources.map((url) => url.pathname)).toEqual(
      expect.arrayContaining([
        `/velocitex/${version}/index.mjs`,
        `/velocitex/${version}/katexmath.mjs`,
        `/velocitex/${version}/runtime/velocitex-core.wasm`,
        `/velocitex/${version}/runtime/katex.min.css`,
      ])
    );
    expect(resources.every((url) => url.origin === cdn.origin)).toBe(true);
  });
});
