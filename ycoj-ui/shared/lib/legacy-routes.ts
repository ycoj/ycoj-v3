/**
 * Legacy → new UI page redirects.
 *
 * The table is intentionally dependency-free so `next.config.ts` can import it
 * at build time without pulling in feature code. Two consumers exist:
 *
 * - `buildLegacyRedirects()` feeds `redirects()` in `next.config.ts`.
 * - `resolveLegacyRoute()` is the pure, testable form of the same table, so the
 *   tests assert what a browser sees (path in → path out, query preserved).
 *
 * Only paths whose destination page exists in `app/**` belong here. A redirect
 * to a missing page turns a legacy deep link into a worse 404 than the current
 * one, so unresolved paths are deliberately left alone; `legacy-routes.test.ts`
 * pins both the mapped set and the omissions.
 *
 * Protocol paths (file downloads, raw bodies, `/api`, `/fs`, `/storage`,
 * OAuth) never appear here: they are rewrites, not page redirects.
 */

export type LegacyRouteRule = {
  /** Stable identifier, used by tests and documentation. */
  id: string;
  /** Legacy page path in Next path-to-regexp syntax. */
  source: string;
  /** New UI page path; `:param` values are substituted from `source`. */
  destination: string;
  /**
   * `true` emits a 308. Path renames are permanent; remaps that move state
   * into a query string stay temporary so the filter shape can still change.
   */
  permanent: boolean;
  /**
   * Whether a `/d/system`-prefixed twin is emitted as well. `system` is the
   * root domain, so `/d/system/x` and `/x` are the same resource. Other domain
   * ids are not redirected: the new UI cannot represent them and dropping the
   * prefix would silently serve a different domain's content.
   */
  domainScoped?: boolean;
  /** Why this mapping exists; kept next to the rule for the review report. */
  note: string;
};

/** Root domain id. Backend `url()` prefixes cross-domain links with `/d/<id>`. */
export const LEGACY_DOMAIN_PREFIX = '/d/system';

/**
 * Remaining path after `/p/` that must reach the backend instead of a page:
 * binary downloads, raw solution bodies, the feedback POST target, and the
 * HTML→Markdown job endpoints.
 */
const PROBLEM_PROTOCOL_SUFFIXES = [
  '[^/]+/file/[^/]+',
  '[^/]+/solution/[^/]+/raw',
  '[^/]+/solution/[^/]+/[^/]+/raw',
  '[^/]+/feedback',
  '[^/]+/html-to-markdown(?:/[^/]+)?',
].join('|');

/** `/discuss` raw bodies answer with JSON/text and must stay backend-only. */
const DISCUSSION_RAW_SUFFIX = '(?!.*/raw$)';

export const LEGACY_ROUTE_RULES: readonly LegacyRouteRule[] = [
  {
    id: 'problem-category',
    source: '/p/category/:category',
    destination: '/problem?q=category::category',
    permanent: false,
    note: 'Legacy tag landing page; the new list filters by a `category:` query.',
  },
  {
    id: 'problem-list',
    source: '/p',
    destination: '/problem',
    permanent: true,
    note: 'Problem list.',
  },
  {
    id: 'problem-pages',
    source: `/p/:path((?!(?:${PROBLEM_PROTOCOL_SUFFIXES})$).*)`,
    destination: '/problem/:path',
    permanent: true,
    note: 'Problem detail and its solution/files/edit/stat/hack sub-pages.',
  },
  {
    id: 'discussion-list',
    source: '/discuss',
    destination: '/discussion',
    permanent: true,
    note: 'Discussion list.',
  },
  {
    id: 'discussion-node-create',
    source: '/discuss/node/:name/create',
    destination: '/discussion/create?node=:name',
    permanent: false,
    note: 'New topic inside a standalone node; the node became a query filter.',
  },
  {
    id: 'discussion-node',
    source: '/discuss/node/:name',
    destination: '/discussion?node=:name',
    permanent: false,
    note: 'Standalone node listing; the node became a query filter.',
  },
  {
    id: 'discussion-pages',
    source: `/discuss/:path(${DISCUSSION_RAW_SUFFIX}.*)`,
    destination: '/discussion/:path',
    permanent: true,
    note: 'Topic detail/edit and resource-scoped nodes (problem/contest/training/homework).',
  },
  {
    id: 'manage-user-import',
    source: '/manage/userimport',
    destination: '/manage/user-import',
    permanent: true,
    note: 'User bulk import moved under a hyphenated slug.',
  },
  {
    id: 'manage-problem-feedback',
    source: '/manage/problem-feedback',
    destination: '/problem/feedback',
    permanent: true,
    note: 'Problem feedback moderation lives with the problem features now.',
  },
  {
    id: 'home-security',
    source: '/home/security',
    destination: '/home/settings/security',
    permanent: true,
    note: 'Account security moved into the settings shell.',
  },
  {
    id: 'contest-problems',
    source: '/contest/:tid/problems',
    destination: '/contest/:tid',
    permanent: true,
    note: 'The contest detail page now carries its problem list.',
  },
  {
    id: 'problem-import-zshfoj',
    source: '/problem/import/zshfoj',
    destination: '/problem/import/lvj',
    permanent: true,
    note: 'The ZSHFOJ importer reports itself as LVJ in the new UI.',
  },
  {
    id: 'domain-root',
    source: LEGACY_DOMAIN_PREFIX,
    destination: '/',
    permanent: true,
    domainScoped: false,
    note: 'Bare root-domain prefix; the backend only strips it with a trailing path.',
  },
];

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: boolean;
};

type CompiledPattern = {
  regex: RegExp;
  keys: string[];
};

const compiledPatterns = new Map<string, CompiledPattern>();

function escapeLiteral(character: string) {
  return /[\\^$.*+?()[\]{}|/]/.test(character) ? `\\${character}` : character;
}

/**
 * Compiles the subset of Next path-to-regexp used by the table: `:name`,
 * `:name*`, and `:name(<regex>)`. Keeping it local means the tests exercise
 * the declared table without importing Next internals.
 */
function compilePattern(pattern: string): CompiledPattern {
  const cached = compiledPatterns.get(pattern);
  if (cached) return cached;

  let regex = '^';
  const keys: string[] = [];
  let index = 0;

  while (index < pattern.length) {
    const character = pattern[index];
    if (character !== ':') {
      regex += escapeLiteral(character);
      index += 1;
      continue;
    }

    let cursor = index + 1;
    let name = '';
    while (cursor < pattern.length && /[A-Za-z0-9_]/.test(pattern[cursor])) {
      name += pattern[cursor];
      cursor += 1;
    }
    if (!name) {
      regex += '\\:';
      index += 1;
      continue;
    }
    keys.push(name);

    if (pattern[cursor] === '(') {
      let depth = 0;
      let end = cursor;
      for (; end < pattern.length; end += 1) {
        if (pattern[end] === '(') depth += 1;
        else if (pattern[end] === ')') {
          depth -= 1;
          if (depth === 0) {
            end += 1;
            break;
          }
        }
      }
      regex += `(${pattern.slice(cursor + 1, end - 1)})`;
      index = end;
      continue;
    }

    if (pattern[cursor] === '*') {
      regex += '(.*)';
      index = cursor + 1;
      continue;
    }

    regex += '([^/]+)';
    index = cursor;
  }

  const compiled = { regex: new RegExp(`${regex}/?$`), keys };
  compiledPatterns.set(pattern, compiled);
  return compiled;
}

function extractParams(compiled: CompiledPattern, match: RegExpExecArray) {
  const params: Record<string, string> = {};
  compiled.keys.forEach((key, position) => {
    params[key] = match[position + 1] ?? '';
  });
  return params;
}

function applyParams(destination: string, params: Record<string, string>) {
  return destination.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) =>
    key in params ? params[key] : ''
  );
}

/** `/problem/` and `/problem` are the same page; Next re-normalizes the slash. */
function withoutTrailingSlash(path: string) {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function mergeSearch(destination: string, search: string) {
  const [rawPath, existing = ''] = destination.split('?');
  const pathname = withoutTrailingSlash(rawPath);
  if (!search) return existing ? `${pathname}?${existing}` : pathname;

  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  if (![...params.keys()].length)
    return existing ? `${pathname}?${existing}` : pathname;

  const merged = new URLSearchParams(existing);
  // Destination values win; everything else survives the redirect.
  params.forEach((value, key) => {
    if (!merged.has(key)) merged.append(key, value);
  });
  const query = merged.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export type LegacyRouteMatch = {
  id: string;
  destination: string;
  permanent: boolean;
};

/**
 * Resolves a legacy request to its new UI destination, including the incoming
 * query string. Returns `null` when the path is not a legacy page.
 */
export function resolveLegacyRoute(
  pathname: string,
  search = '',
  rules: readonly LegacyRouteRule[] = LEGACY_ROUTE_RULES
): LegacyRouteMatch | null {
  for (const rule of rules) {
    const sources =
      rule.domainScoped === false
        ? [rule.source]
        : [rule.source, `${LEGACY_DOMAIN_PREFIX}${rule.source}`];

    for (const source of sources) {
      const compiled = compilePattern(source);
      const match = compiled.regex.exec(pathname);
      if (!match) continue;
      const destination = applyParams(
        rule.destination,
        extractParams(compiled, match)
      );
      return {
        id: rule.id,
        destination: mergeSearch(destination, search),
        permanent: rule.permanent,
      };
    }
  }
  return null;
}

/** Every rule id matching `pathname`, in table order. Used to guard ordering. */
export function matchLegacyRules(
  pathname: string,
  rules: readonly LegacyRouteRule[] = LEGACY_ROUTE_RULES
) {
  return rules
    .filter((rule) => {
      const sources =
        rule.domainScoped === false
          ? [rule.source]
          : [rule.source, `${LEGACY_DOMAIN_PREFIX}${rule.source}`];
      return sources.some((source) =>
        compilePattern(source).regex.test(pathname)
      );
    })
    .map((rule) => rule.id);
}

/** Next.js `redirects()` entries, in match order (first match wins). */
export function buildLegacyRedirects(
  rules: readonly LegacyRouteRule[] = LEGACY_ROUTE_RULES
): LegacyRedirect[] {
  const redirects: LegacyRedirect[] = [];
  for (const rule of rules) {
    redirects.push({
      source: rule.source,
      destination: rule.destination,
      permanent: rule.permanent,
    });
    if (rule.domainScoped !== false) {
      redirects.push({
        source: `${LEGACY_DOMAIN_PREFIX}${rule.source}`,
        destination: rule.destination,
        permanent: rule.permanent,
      });
    }
  }
  return redirects;
}
