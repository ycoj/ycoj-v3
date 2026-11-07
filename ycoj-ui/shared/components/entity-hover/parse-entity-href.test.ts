import { parseEntityHref } from '@/shared/components/entity-hover/parse-entity-href';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('parseEntityHref', () => {
  it.each([
    ['/problem/P1000', { kind: 'problem', id: 'P1000' }],
    ['/problem/P1000?tid=abc#sample', { kind: 'problem', id: 'P1000' }],
    ['/problem/P1000/solution', { kind: 'problem', id: 'P1000' }],
    ['/p/1001', { kind: 'problem', id: '1001' }],
    [
      '/contest/665f00000000000000000001',
      { kind: 'contest', id: '665f00000000000000000001' },
    ],
    [
      '/homework/665f00000000000000000002/scoreboard',
      { kind: 'homework', id: '665f00000000000000000002' },
    ],
    [
      '/training/665f00000000000000000003',
      { kind: 'training', id: '665f00000000000000000003' },
    ],
    [
      '/d/system/contest/665f00000000000000000001/edit',
      { kind: 'contest', id: '665f00000000000000000001' },
    ],
    ['/user/12', { kind: 'user', id: '12' }],
    ['/user/-1001/blog', { kind: 'user', id: '-1001' }],
    ['problem/P1000', { kind: 'problem', id: 'P1000' }],
  ] as const)('reads %s', (href, reference) => {
    expect(parseEntityHref(href)).toEqual(reference);
  });

  it.each([
    '/problem/create',
    '/problem/import/hydro',
    '/problem/solution-review',
    '/problem/feedback',
    '/p/category/dp',
    '/contest/create',
    '/contest/analysis',
    '/contest/analysis/job-1',
    '/homework/create',
    '/training/create',
    '/user/sudo',
    '/user/alice',
    '/user/0',
    '/d/school/contest/665f00000000000000000001/edit',
    '/d/school/problem/1001',
    'https://codeforces.com/contest/1234/problem/A',
    'https://luogu.com.cn/problem/P1000',
    'https://ycoj.cc/problem/P1000',
    '/discussion/problem/1000',
    '/login?next=/problem/P1000',
    'mailto:a@b.c',
    '#sample',
    '',
  ])('ignores %s', (href) => {
    expect(parseEntityHref(href)).toBeNull();
  });

  describe('same-origin absolute links', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('reads a link on this site and ignores another host', () => {
      vi.stubGlobal('window', { location: { origin: 'https://ycoj.cc' } });
      expect(parseEntityHref('https://ycoj.cc/problem/P1000')).toEqual({
        kind: 'problem',
        id: 'P1000',
      });
      expect(parseEntityHref('https://ycoj.cc/d/system/problem/P1000')).toEqual(
        { kind: 'problem', id: 'P1000' }
      );
      expect(
        parseEntityHref('https://codeforces.com/contest/1234/problem/A')
      ).toBeNull();
      expect(parseEntityHref('https://luogu.com.cn/problem/P1000')).toBeNull();
      expect(
        parseEntityHref('https://ycoj.cc/d/school/problem/1001')
      ).toBeNull();
    });
  });
});
