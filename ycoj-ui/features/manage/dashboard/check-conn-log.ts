export type CheckConnLevel = 'log' | 'warn' | 'error';

export type CheckConnEntry = {
  level: CheckConnLevel;
  lines: string[];
};

const LEVELS = new Set<CheckConnLevel>(['log', 'warn', 'error']);

function payloadLines(payload: unknown): string[] {
  if (payload === undefined || payload === null) return [];
  if (typeof payload === 'string') return payload.split('\n');
  try {
    return JSON.stringify(payload, null, 2).split('\n');
  } catch {
    return [String(payload)];
  }
}

/**
 * Parses a `/manage/check-conn` frame.
 * Frames are `{ type: "log" | "warn" | "error", payload }`; the backend may
 * also send transport keepalive strings, which are ignored.
 */
export function parseCheckConnFrame(frame: unknown): CheckConnEntry | null {
  if (!frame || typeof frame !== 'object') return null;
  const record = frame as { type?: unknown; payload?: unknown };
  if (typeof record.type !== 'string') return null;
  if (!LEVELS.has(record.type as CheckConnLevel)) return null;
  return {
    level: record.type as CheckConnLevel,
    lines: payloadLines(record.payload),
  };
}

export function parseCheckConnMessage(value: unknown): CheckConnEntry | null {
  if (typeof value !== 'string') return parseCheckConnFrame(value);
  if (value === 'ping' || value === 'pong' || value === 'shorty') return null;
  try {
    return parseCheckConnFrame(JSON.parse(value));
  } catch {
    return null;
  }
}

/** Keeps the most recent entries so a long check cannot grow without bound. */
export function appendCheckConnEntries(
  entries: CheckConnEntry[],
  next: CheckConnEntry,
  limit = 300
): CheckConnEntry[] {
  const merged = [...entries, next];
  return merged.length > limit ? merged.slice(merged.length - limit) : merged;
}
