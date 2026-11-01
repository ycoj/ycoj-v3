import {
  buildLegacyRedirects,
  LEGACY_ROUTE_RULES,
  matchLegacyRules,
  resolveLegacyRoute,
  type LegacyRouteRule,
} from './legacy-routes';
import { describe, expect, it } from 'vitest';

/**
 * URL-visible routes that exist in `app/**` at the time this table was
 * written (route groups such as `(app)` and `(list)` are not part of the
 * URL). Kept here, rather than discovered at test time, so the assertion is
 * hermetic; update it together with the redirect table when pages move.
 */
const KNOWN_ROUTES = [
  '/',
  '/home',
  '/home/award',
  '/home/changeMail/[code]',
  '/home/messages',
  '/home/realname',
  '/home/realname/result',
  '/home/settings/account',
  '/home/settings/domain',
  '/home/settings/preference',
  '/home/settings/security',
  '/problem',
  '/problem/create',
  '/problem/feedback',
  '/problem/import/[format]',
  '/problem/solution-review',
  '/problem/[pid]',
  '/problem/[pid]/config',
  '/problem/[pid]/edit',
  '/problem/[pid]/files',
  '/problem/[pid]/generate',
  '/problem/[pid]/hack/[rid]',
  '/problem/[pid]/solution',
  '/problem/[pid]/solution/create',
  '/problem/[pid]/solution/[psid]',
  '/problem/[pid]/solution/[psid]/edit',
  '/problem/[pid]/stat',
  '/problem/[pid]/submit',
  '/discussion',
  '/discussion/create',
  '/discussion/[did]',
  '/discussion/[did]/edit',
  '/discussion/[type]/[name]',
  '/discussion/[type]/[name]/create',
  '/contest',
  '/contest/create',
  '/contest/analysis',
  '/contest/analysis/[aid]',
  '/contest/[tid]',
  '/contest/[tid]/balloon',
  '/contest/[tid]/bulk-submit',
  '/contest/[tid]/clarification',
  '/contest/[tid]/edit',
  '/contest/[tid]/management',
  '/contest/[tid]/plagiarism',
  '/contest/[tid]/print',
  '/contest/[tid]/scoreboard',
  '/contest/[tid]/solution/create',
  '/contest/[tid]/solution/[sid]',
  '/contest/[tid]/solution/[sid]/edit',
  '/contest/[tid]/user',
  '/homework',
  '/homework/create',
  '/homework/[tid]',
  '/homework/[tid]/edit',
  '/homework/[tid]/file',
  '/homework/[tid]/scoreboard',
  '/training',
  '/training/create',
  '/training/[tid]',
  '/training/[tid]/edit',
  '/training/[tid]/file',
  '/preliminary',
  '/preliminary/create',
  '/preliminary/[paperId]',
  '/preliminary/[paperId]/edit',
  '/preliminary/[paperId]/attempt/[attemptId]',
  '/record',
  '/record/[rid]',
  '/ranking',
  '/user/[uid]',
  '/user/sudo',
  '/file',
  '/blog/[uid]',
  '/blog/[uid]/create',
  '/blog/[uid]/[did]',
  '/blog/[uid]/[did]/edit',
  '/wiki/help',
  '/wiki/about',
  '/manage',
  '/manage/ai-provider',
  '/manage/award',
  '/manage/realname',
  '/manage/user-expiration',
  '/manage/user-import',
  '/paste',
  '/paste/[id]',
  '/paste/[id]/edit',
  '/login',
  '/register',
  '/register/[code]',
  '/lostpass',
  '/lostpass/[code]',
  '/draw',
  '/tools/graph-editor',
];

/** Matches a destination pathname against `KNOWN_ROUTES` (`[x]` = segment). */
function routeExists(pathname: string, routes: readonly string[]) {
  const segments = pathname.split('/').filter(Boolean);
  return routes.some((route) => {
    const routeSegments = route.split('/').filter(Boolean);
    if (routeSegments.length !== segments.length) return false;
    return routeSegments.every((segment, index) =>
      segment.startsWith('[')
        ? segments[index].length > 0
        : segment === segments[index]
    );
  });
}

function pathnameOf(destination: string) {
  return destination.split('?')[0];
}

/** Destination for a path the table must handle; fails loudly when it does not. */
function destinationOf(pathname: string, search = '') {
  const match = resolveLegacyRoute(pathname, search);
  if (!match) throw new Error(`no legacy route for ${pathname}${search}`);
  return match.destination;
}

describe('resolveLegacyRoute', () => {
  it.each([
    // Problem namespace.
    ['/p', '/problem'],
    ['/p/1000', '/problem/1000'],
    ['/p/1000/submit', '/problem/1000/submit'],
    ['/p/1000/edit', '/problem/1000/edit'],
    ['/p/1000/config', '/problem/1000/config'],
    ['/p/1000/files', '/problem/1000/files'],
    ['/p/1000/generate', '/problem/1000/generate'],
    ['/p/1000/solution', '/problem/1000/solution'],
    ['/p/1000/solution/2000', '/problem/1000/solution/2000'],
    ['/p/1000/solution/2000/edit', '/problem/1000/solution/2000/edit'],
    ['/p/1000/stat', '/problem/1000/stat'],
    ['/p/1000/hack/3000', '/problem/1000/hack/3000'],
    ['/p/solution-review', '/problem/solution-review'],
    // Category redirect folds the tag into the list query.
    ['/p/category/dp', '/problem?q=category:dp'],
    // Discussion namespace.
    ['/discuss', '/discussion'],
    ['/discuss/66a1f0', '/discussion/66a1f0'],
    ['/discuss/66a1f0/edit', '/discussion/66a1f0/edit'],
    ['/discuss/problem/1000', '/discussion/problem/1000'],
    ['/discuss/problem/1000/create', '/discussion/problem/1000/create'],
    ['/discuss/node/announcements', '/discussion?node=announcements'],
    [
      '/discuss/node/announcements/create',
      '/discussion/create?node=announcements',
    ],
    // Renamed and relocated pages.
    ['/manage/userimport', '/manage/user-import'],
    ['/manage/problem-feedback', '/problem/feedback'],
    ['/home/security', '/home/settings/security'],
    ['/contest/c1/problems', '/contest/c1'],
    ['/problem/import/zshfoj', '/problem/import/lvj'],
    // Root-domain prefix is transparent.
    ['/d/system', '/'],
    ['/d/system/p/1000', '/problem/1000'],
    ['/d/system/discuss/66a1f0', '/discussion/66a1f0'],
    ['/d/system/manage/userimport', '/manage/user-import'],
  ])('maps %s to %s', (pathname, expected) => {
    expect(resolveLegacyRoute(pathname)?.destination).toBe(expected);
  });

  it.each([
    // Binary downloads and raw bodies stay on the backend.
    '/p/1000/file/a.in',
    '/p/1000/solution/2000/raw',
    '/p/1000/solution/2000/3000/raw',
    '/p/1000/feedback',
    '/p/1000/html-to-markdown',
    '/discuss/66a1f0/raw',
    '/discuss/66a1f0/2000/raw',
    '/discuss/66a1f0/2000/3000/raw',
    // Non-root domains have no new-UI representation.
    '/d/class/p/1000',
    '/d/class/discuss/66a1f0',
    // Already-new paths and unrelated paths.
    '/problem/1000',
    '/discussion/66a1f0',
    '/home',
    '/api/p/1000/files',
    '/fs/system/a.png',
    '/storage',
    '/oauth/github/login',
  ])('leaves %s alone', (pathname) => {
    expect(resolveLegacyRoute(pathname)).toBeNull();
  });

  it('preserves the incoming query string', () => {
    expect(destinationOf('/p/1000/submit', '?tid=c1')).toBe(
      '/problem/1000/submit?tid=c1'
    );
    expect(destinationOf('/discuss', '?page=3')).toBe('/discussion?page=3');
    expect(destinationOf('/p/1000/solution', '?page=2')).toBe(
      '/problem/1000/solution?page=2'
    );
  });

  it('keeps filters and return URLs on relocated pages', () => {
    expect(
      destinationOf('/manage/problem-feedback', '?page=2&status=resolved')
    ).toBe('/problem/feedback?page=2&status=resolved');
    expect(
      resolveLegacyRoute('/login', '?redirect=%2Fhome%2Fsecurity')
    ).toBeNull();
  });

  it('lets destination values win over incoming ones', () => {
    expect(
      destinationOf('/discuss/node/announcements', '?node=other&page=2')
    ).toBe('/discussion?node=announcements&page=2');
  });

  it('reports permanence per rule', () => {
    expect(resolveLegacyRoute('/p/1000')?.permanent).toBe(true);
    expect(resolveLegacyRoute('/p/category/dp')?.permanent).toBe(false);
    expect(resolveLegacyRoute('/discuss/node/x')?.permanent).toBe(false);
  });
});

describe('legacy route table', () => {
  it('never maps a path onto itself', () => {
    const offenders = LEGACY_ROUTE_RULES.filter(
      (rule) => pathnameOf(rule.destination) === rule.source
    );
    expect(offenders).toEqual([]);
  });

  it('never redirects into the backend domain prefix', () => {
    const offenders = LEGACY_ROUTE_RULES.filter((rule) =>
      pathnameOf(rule.destination).startsWith('/d/')
    );
    expect(offenders).toEqual([]);
  });

  it('never redirects to a page that does not exist', () => {
    const missing = new Set<string>();
    for (const pathname of [
      ...LEGACY_ROUTE_RULES.map((rule) => pathnameOf(rule.destination)),
      ...[
        '/p/1000',
        '/p/1000/solution/2000',
        '/discuss/66a1f0',
        '/discuss/problem/1000/create',
        '/contest/c1/problems',
      ].map((path) => pathnameOf(resolveLegacyRoute(path)?.destination ?? '')),
    ]) {
      if (!routeExists(pathname, KNOWN_ROUTES)) missing.add(pathname);
    }
    expect([...missing]).toEqual([]);
  });

  it('orders overlapping rules so the most specific wins', () => {
    expect(matchLegacyRules('/p/category/dp')[0]).toBe('problem-category');
    expect(matchLegacyRules('/discuss/node/x')[0]).toBe('discussion-node');
    expect(matchLegacyRules('/discuss/node/x/create')[0]).toBe(
      'discussion-node-create'
    );
    expect(matchLegacyRules('/d/system/discuss/node/x')[0]).toBe(
      'discussion-node'
    );
    expect(matchLegacyRules('/p/1000')[0]).toBe('problem-pages');
    expect(matchLegacyRules('/d/system/p/1000')[0]).toBe('problem-pages');
  });

  it('emits root-domain twins for every page rule', () => {
    const redirects = buildLegacyRedirects();
    const prefixed = redirects.filter((route) =>
      route.source.startsWith('/d/system/')
    );
    const expected = LEGACY_ROUTE_RULES.filter(
      (rule) => rule.domainScoped !== false
    ).length;
    expect(prefixed).toHaveLength(expected);
  });

  it('emits no duplicate sources', () => {
    const sources = buildLegacyRedirects().map((route) => route.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it('generates exactly one redirect for the legacy problem list', () => {
    const sources = buildLegacyRedirects().map((route) => route.source);
    expect(sources.filter((source) => source === '/p')).toHaveLength(1);
    expect(sources).not.toContain('/p/:path*');
  });

  it('honours an injected table', () => {
    const injected: LegacyRouteRule[] = [
      {
        id: 'injected',
        source: '/legacy',
        destination: '/about',
        permanent: false,
        note: 'test fixture',
      },
    ];
    expect(resolveLegacyRoute('/legacy', '', injected)?.destination).toBe(
      '/about'
    );
    expect(resolveLegacyRoute('/p/1000', '', injected)).toBeNull();
  });

  it('never redirects a path that the rewrites must forward', () => {
    // Downloads, raw bodies and domain-scoped API calls are protocol paths;
    // a 308 here would send the browser to a page instead of the bytes.
    for (const pathname of [
      '/p/1000/file/a.in',
      '/p/1000/solution/2/raw',
      '/discuss/66a1f0/raw',
      '/file/7/a.zip',
      '/storage/avatar/a/b.png',
      '/api/p/1000/files',
      '/fs/system/a.png',
      '/oauth/github/login',
      '/contest/c1/file/public/a.zip',
    ]) {
      expect(resolveLegacyRoute(pathname)).toBeNull();
    }
  });
});
