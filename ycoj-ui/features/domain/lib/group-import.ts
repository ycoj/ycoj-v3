import type { DomainGroupDoc } from '@/api/server/method/domain/types';

/**
 * Parses CSV-style group import text: one group per line as
 * `groupName,uid1,uid2,...`. Blank lines and a leading BOM are ignored.
 * Returns errors with 1-based line numbers so the UI can point at the row.
 */
export function parseGroupImport(text: string): {
  groups: Map<string, number[]>;
  errors: string[];
} {
  const groups = new Map<string, number[]>();
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, '').split('\n');

  lines.forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const [name, ...rest] = line.split(',').map((token) => token.trim());
    if (!name) return;
    const uids: number[] = [];
    for (const token of rest) {
      if (!token) continue;
      const uid = Number(token);
      if (!Number.isSafeInteger(uid) || uid <= 0) {
        errors.push(`Line ${index + 1}: invalid UID "${token}".`);
        return;
      }
      uids.push(uid);
    }
    groups.set(name, Array.from(new Set(uids)));
  });

  return { groups, errors };
}

/** Renders groups back into the same CSV format used for import. */
export function serializeGroups(groups: DomainGroupDoc[]) {
  return groups
    .map((group) => [group.name, ...(group.uids ?? [])].join(','))
    .join('\n');
}

/** Validates a new group name: non-empty and untrimmed of whitespace only. */
export function isValidGroupName(name: string) {
  const trimmed = name.trim();
  return !!trimmed && trimmed.length <= 255 && !trimmed.includes(',');
}
