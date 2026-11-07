import { getEntityPreview } from '@/api/client/method/entity-preview';
import type {
  EntityKind,
  EntityPreview,
  EntityPreviewResult,
} from '@/shared/components/entity-hover/types';

const DENIED_ERRORS = new Set([
  'PermissionError',
  'PrivilegeError',
  'NotAssignedError',
  'RealnameRequiredError',
]);

const KINDS = new Set<EntityKind>([
  'problem',
  'contest',
  'homework',
  'training',
  'user',
]);

const FAILED_TTL_MS = 15_000;

type CacheEntry = {
  result: EntityPreviewResult;
  expiresAt: number | null;
};

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<EntityPreviewResult>>();

export function entityPreviewCacheKey(kind: EntityKind, id: string) {
  return `${kind}:${id}`;
}

export function peekEntityPreview(kind: EntityKind, id: string) {
  const key = entityPreviewCacheKey(kind, id);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function rememberEntityPreview(
  kind: EntityKind,
  id: string,
  result: EntityPreviewResult
) {
  cache.set(entityPreviewCacheKey(kind, id), {
    result,
    expiresAt:
      !result.ok && result.reason === 'failed'
        ? Date.now() + FAILED_TTL_MS
        : null,
  });
}

export function clearEntityPreviewCache() {
  cache.clear();
  inflight.clear();
}

function isPreview(value: object): value is EntityPreview {
  if (!('kind' in value) || typeof value.kind !== 'string') return false;
  if (!KINDS.has(value.kind as EntityKind)) return false;
  if (value.kind === 'user') {
    return 'uname' in value && typeof value.uname === 'string';
  }
  return 'title' in value && typeof value.title === 'string';
}

export function classifyEntityPreview(data: unknown): EntityPreviewResult {
  if (!data || typeof data !== 'object') {
    return { ok: false, reason: data === null ? 'missing' : 'failed' };
  }
  if ('error' in data && data.error && typeof data.error === 'object') {
    const name =
      'name' in data.error && typeof data.error.name === 'string'
        ? data.error.name
        : '';
    if (DENIED_ERRORS.has(name)) return { ok: false, reason: 'denied' };
    if (name.endsWith('NotFoundError')) return { ok: false, reason: 'missing' };
    return { ok: false, reason: 'failed' };
  }
  if (isPreview(data)) return { ok: true, preview: data };
  return { ok: false, reason: 'failed' };
}

async function fetchEntityPreview(
  kind: EntityKind,
  id: string
): Promise<EntityPreviewResult> {
  try {
    const data = await getEntityPreview(kind, id).send();
    return classifyEntityPreview(data);
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

/** Loads one preview, sharing the in-flight request and keeping the result. */
export function loadEntityPreview(kind: EntityKind, id: string) {
  const key = entityPreviewCacheKey(kind, id);
  const cached = peekEntityPreview(kind, id);
  if (cached) return Promise.resolve(cached);
  const pending = inflight.get(key);
  if (pending) return pending;
  const request = fetchEntityPreview(kind, id)
    .then((result) => {
      rememberEntityPreview(kind, id, result);
      return result;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}
