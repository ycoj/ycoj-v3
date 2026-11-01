import type { Root } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { unified } from 'unified';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it('highlights standalone code and Markdown using only the local WASM', async () => {
  vi.stubEnv('NEXT_PUBLIC_STATIC_ASSET_PREFIX', 'https://cdn.invalid');
  const originalFetch = window.fetch.bind(window);
  const wasmUrls: URL[] = [];
  vi.stubGlobal(
    'fetch',
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href
      );
      if (url.origin !== window.location.origin) {
        throw new Error(`Unexpected external resource: ${url.href}`);
      }
      if (url.pathname.endsWith('/onig.wasm')) wasmUrls.push(url);
      return originalFetch(input, init);
    }
  );

  const { highlightCodeToHtml } = await import('./code-highlighter');
  expect(highlightCodeToHtml('int value = 1;', 'cpp').html).toContain(
    'class="pl-k"'
  );

  const { default: rehypeCodeBlocks } =
    await import('@/shared/components/markdown/plugins/rehype-code-blocks');
  const tree: Root = {
    type: 'root',
    children: [
      {
        type: 'element',
        tagName: 'pre',
        properties: {},
        children: [
          {
            type: 'element',
            tagName: 'code',
            properties: { className: ['language-cpp'] },
            children: [{ type: 'text', value: 'int value = 1;' }],
          },
        ],
      },
    ],
  };
  await unified().use(rehypeCodeBlocks).run(tree);
  expect(toHtml(tree)).toContain('class="pl-k"');
  expect(wasmUrls.length).toBeGreaterThan(0);
  expect(
    wasmUrls.every(
      (url) =>
        url.pathname === '/vendor/vscode-oniguruma@2.0.1/release/onig.wasm'
    )
  ).toBe(true);
});
