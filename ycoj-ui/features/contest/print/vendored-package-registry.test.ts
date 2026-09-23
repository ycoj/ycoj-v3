import { ensureGzippedTarball } from './vendored-package-registry';
import { describe, expect, it } from 'vitest';

const GZIP_MAGIC = [0x1f, 0x8b] as const;

/** Minimal ustar archive: `ustar` magic at offset 257 inside a 512 block. */
function rawTar(size = 1024): Uint8Array {
  const tar = new Uint8Array(size);
  tar.set(new TextEncoder().encode('ustar'), 257);
  return tar;
}

async function gunzip(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

describe('ensureGzippedTarball', () => {
  it('passes gzip-magic bytes through untouched', async () => {
    const gzipped = new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 1, 2, 3]);
    expect(await ensureGzippedTarball(gzipped)).toBe(gzipped);
  });

  it('re-gzips raw tar bytes and round-trips back to the input', async () => {
    const tar = rawTar();
    const result = await ensureGzippedTarball(tar);
    expect(result[0]).toBe(GZIP_MAGIC[0]);
    expect(result[1]).toBe(GZIP_MAGIC[1]);
    expect(await gunzip(result)).toEqual(tar);
  });

  it.each([
    ['empty', new Uint8Array(0)],
    ['short garbage', new Uint8Array([9, 9, 9])],
    [
      'tar-sized non-tar',
      (() => {
        const bytes = new Uint8Array(1024).fill(0x61);
        bytes.set(new TextEncoder().encode('ustaq'), 257);
        return bytes;
      })(),
    ],
  ])(
    'passes %s bytes through so downstream reports the real error',
    async (_name, bytes) => {
      expect(await ensureGzippedTarball(bytes)).toBe(bytes);
    }
  );
});
