import ClientMarkdown from './client-markdown';
import { createElement } from 'react';
import { renderToReadableStream } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

describe('ClientMarkdown server render', () => {
  it('includes formatted markdown in the server html', async () => {
    const stream = await renderToReadableStream(
      createElement(ClientMarkdown, null, 'Hello **world**')
    );
    await stream.allReady;
    const html = await new Response(stream).text();
    expect(html).toContain('<p>Hello <strong>world</strong></p>');
  });
});
