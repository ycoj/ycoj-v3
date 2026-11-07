import type {
  EntityKind,
  EntityReference,
} from '@/shared/components/entity-hover/types';

const KIND_BY_SEGMENT: Record<string, EntityKind> = {
  problem: 'problem',
  p: 'problem',
  contest: 'contest',
  homework: 'homework',
  training: 'training',
  user: 'user',
};

const RESERVED_IDS: Record<EntityKind, ReadonlySet<string>> = {
  problem: new Set([
    'create',
    'import',
    'solution-review',
    'feedback',
    'random',
    'category',
  ]),
  contest: new Set(['create', 'analysis']),
  homework: new Set(['create']),
  training: new Set(['create']),
  user: new Set(['sudo']),
};

function sameSite(url: URL): boolean {
  if (typeof window === 'undefined') return false;
  return url.origin === window.location.origin;
}

function pathnameOf(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      if (!sameSite(url)) return null;
      return url.pathname;
    } catch {
      return null;
    }
  }
  return trimmed.split(/[?#]/)[0] ?? null;
}

/** Resolves a problem, contest, homework, training, or user reference from a link href. */
export function parseEntityHref(href: string): EntityReference | null {
  const pathname = pathnameOf(href);
  if (!pathname) return null;
  const parts = pathname.replace(/^\/|\/$/g, '').split('/');
  // `/d/system` is the root domain. Another domain prefix is a different site.
  if (parts[0] === 'd') {
    if (parts[1] !== 'system') return null;
    parts.splice(0, 2);
  }
  if (parts.length !== 2) return null;
  const segment = parts[0];
  const rawId = parts[1];
  if (!segment || !rawId) return null;
  const kind = KIND_BY_SEGMENT[segment];
  if (!kind || RESERVED_IDS[kind].has(rawId)) return null;
  if (segment === 'p' && rawId === 'category') return null;
  try {
    const id = decodeURIComponent(rawId);
    if (!id || id.includes('/')) return null;
    if (kind === 'user' && (!/^-?\d+$/.test(id) || id === '0')) return null;
    return { kind, id };
  } catch {
    return null;
  }
}
