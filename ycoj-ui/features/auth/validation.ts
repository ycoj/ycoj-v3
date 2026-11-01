/** Mirrors the backend email validation rule so obvious typos fail early. */
export const EMAIL_PATTERN = /^[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

/** Mirrors the backend password rule: at least six characters. */
export const PASSWORD_MIN_LENGTH = 6;

/** Mirrors the backend username rule used when completing a registration. */
export function isValidUsername(value: string) {
  return /^(?:.{3,31}|[一-龥]{2})$/.test(value.trim());
}

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}
