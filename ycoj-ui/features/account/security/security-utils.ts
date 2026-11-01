import type { SecuritySession } from '@/shared/types/security';

/**
 * The backend serializes an authenticator credential id as a BSON Binary,
 * which JSON-encodes to `{ $binary: { base64, subType } }`. The security
 * mutation expects the base64 text the legacy page sent back.
 */
export function credentialIdBase64(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    if ('base64' in value && typeof value.base64 === 'string')
      return value.base64;
    if (
      '$binary' in value &&
      value.$binary &&
      typeof value.$binary === 'object' &&
      'base64' in value.$binary &&
      typeof value.$binary.base64 === 'string'
    )
      return value.$binary.base64;
  }
  return '';
}

/** A short, stable suffix shown next to an authenticator in the list. */
export function authenticatorShortId(value: unknown): string {
  return credentialIdBase64(value).slice(0, 6);
}

export function sessionBrowserLabel(session: SecuritySession) {
  const browser = session.updateUaInfo?.browser;
  if (!browser?.name) return '';
  return [browser.name, browser.version].filter(Boolean).join(' ');
}

export function sessionOsLabel(session: SecuritySession) {
  const os = session.updateUaInfo?.os;
  if (!os?.name) return '';
  return [os.name, os.version].filter(Boolean).join(' ');
}

export function sessionLocationLabel(session: SecuritySession) {
  return session.updateGeoip?.display?.trim() ?? '';
}

export function sessionIpLabel(session: SecuritySession) {
  return (session.updateIp || session.createIp || '').trim();
}

export function sessionHostLabel(session: SecuritySession) {
  return (session.createHost || '').trim();
}

/** Current session first, then most recently used. */
export function sortSessions(sessions: SecuritySession[]) {
  return [...sessions].sort((a, b) => {
    if (Boolean(a.isCurrent) !== Boolean(b.isCurrent))
      return a.isCurrent ? -1 : 1;
    return String(b.updateAt ?? '').localeCompare(String(a.updateAt ?? ''));
  });
}

/** The legacy client generated 13-character base32 secrets for TOTP. */
export function generateTotpSecret(length = 13): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join(
    ''
  );
}

export function otpauthUri(uname: string, secret: string, issuer = 'Hydro') {
  return `otpauth://totp/${encodeURIComponent(`${issuer}:${uname}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}
