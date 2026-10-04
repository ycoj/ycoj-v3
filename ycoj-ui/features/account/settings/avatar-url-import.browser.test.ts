import { AVATAR_MAX_BYTES, importAvatarUrl } from './avatar-url-import';
import { afterEach, describe, expect, it, vi } from 'vitest';

function respond(body: Blob | string | Uint8Array<ArrayBuffer>) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body));
}

afterEach(() => vi.restoreAllMocks());

describe('URL avatar imports', () => {
  it.each(['image/png', 'image/jpeg'])(
    'imports and re-encodes a valid %s as a static PNG',
    async (type) => {
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      canvas.getContext('2d')!.fillRect(0, 0, 2, 2);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((value) => resolve(value!), type)
      );
      respond(blob);
      const file = await importAvatarUrl('https://example.com/image');
      expect(file.type).toBe('image/png');
      const image = await createImageBitmap(file);
      expect([image.width, image.height]).toEqual([2, 2]);
      image.close();
    }
  );

  it.each([
    'GIF89a',
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    '<html>Not an image</html>',
  ])('rejects unsupported content disguised as PNG: %s', async (body) => {
    respond(new Blob([body], { type: 'image/png' }));
    await expect(
      importAvatarUrl('https://example.com/avatar.png')
    ).rejects.toThrow('type');
  });

  it('rejects an undecodable file with a PNG signature', async () => {
    respond(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
    await expect(
      importAvatarUrl('https://example.com/avatar.png')
    ).rejects.toThrow();
  });

  it('limits downloaded content even without a Content-Length header', async () => {
    respond(new Uint8Array(AVATAR_MAX_BYTES + 1));
    await expect(
      importAvatarUrl('https://example.com/avatar.png')
    ).rejects.toThrow('size');
  });

  it('rejects inaccessible hosts and redirects', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('Failed to fetch')
    );
    await expect(
      importAvatarUrl('https://example.com/avatar.png')
    ).rejects.toThrow();
  });
});
