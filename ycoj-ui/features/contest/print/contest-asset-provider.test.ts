import { createContestAssetProvider } from './contest-asset-provider';
import type { FileInfo } from '@/shared/types/file';
import { describe, expect, it, vi } from 'vitest';

const file = (name: string): FileInfo => ({
  _id: `files/${name}`,
  name,
  size: 1,
  etag: `etag-${name}`,
  lastModified: new Date('2026-01-01T00:00:00.000Z'),
});

describe('createContestAssetProvider', () => {
  const provider = createContestAssetProvider({
    tid: '7',
    contestFiles: [file('poster.png')],
    problemFiles: {
      1001: [file('range.png'), file('样例 图.png')],
      1002: [],
    },
  });

  it('resolves contest-scope files to the public contest endpoint', () => {
    expect(
      provider.resolveFile({ kind: 'contest', tid: '7' }, 'poster.png')
    ).toBe('/api/contest/7/file/public/poster.png');
    expect(
      provider.resolveFile({ kind: 'contest', tid: '7' }, 'missing.png')
    ).toBeNull();
  });

  it('resolves problem-scope files per docId with tid', () => {
    expect(
      provider.resolveFile(
        { kind: 'problem', tid: '7', problemId: 1001 },
        'range.png'
      )
    ).toBe('/api/p/1001/file/range.png?tid=7');
    expect(
      provider.resolveFile(
        { kind: 'problem', tid: '7', problemId: 1001 },
        'poster.png'
      )
    ).toBeNull();
    expect(
      provider.resolveFile(
        { kind: 'problem', tid: '7', problemId: 1002 },
        'range.png'
      )
    ).toBeNull();
  });

  it('percent-encodes non-ASCII file names', () => {
    expect(
      provider.resolveFile(
        { kind: 'problem', tid: '7', problemId: 1001 },
        '样例 图.png'
      )
    ).toBe(`/api/p/1001/file/${encodeURIComponent('样例 图.png')}?tid=7`);
  });

  it('fetches resolved URLs and rejects non-ok responses', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      )
      .mockResolvedValueOnce(new Response('nope', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const bytes = await provider.fetchAsset('/x.png');
      expect([...bytes]).toEqual([1, 2, 3]);
      await expect(provider.fetchAsset('/y.png')).rejects.toThrow('404');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
