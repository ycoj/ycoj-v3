import Ajv from 'ajv';
import { load as loadYaml } from 'js-yaml';

const ajv = new Ajv({ allErrors: true, strict: false });

export type ConfigValidationResult =
  { kind: 'invalid'; message: string } | { kind: 'valid' };

/**
 * Validates raw configuration YAML against the backend schema snapshot.
 * `[hidden]` secret placeholders are replaced with the original secret before
 * validating so schema type checks still pass.
 */
export function validateSystemConfig(
  source: string,
  schema: Record<string, unknown>,
  original?: string
): ConfigValidationResult {
  let parsed: unknown;
  try {
    parsed = loadYaml(source);
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { kind: 'invalid', message: 'Configuration must be a mapping.' };
  }

  let candidate: unknown = parsed;
  if (original && draftHasHiddenMarker(source)) {
    try {
      const originalParsed = loadYaml(original);
      candidate = restoreHiddenSecrets(parsed, originalParsed);
    } catch {
      // Keep the draft as-is when the original cannot be parsed.
    }
  }

  try {
    const validate = ajv.compile(schema);
    if (validate(candidate)) return { kind: 'valid' };
    const [first] = validate.errors ?? [];
    return {
      kind: 'invalid',
      message: first
        ? `${first.instancePath || '/'} ${first.message ?? ''}`.trim()
        : 'Configuration does not match the schema.',
    };
  } catch (error) {
    return {
      kind: 'invalid',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Whether a YAML draft still carries the `[hidden]` secret placeholder.
 * Handles both the plain and quoted forms the editor may produce.
 */
function draftHasHiddenMarker(source: string) {
  return /\[hidden\]/.test(source);
}

/**
 * Walks both trees; wherever the draft kept the `[hidden]` placeholder the
 * original value is substituted. The backend performs the same comparison
 * before saving, so validation matches what will be stored.
 */
function restoreHiddenSecrets(draft: unknown, original: unknown): unknown {
  if (isHiddenMarker(draft)) return original;
  if (Array.isArray(draft)) {
    const base = Array.isArray(original) ? original : [];
    return draft.map((item, index) => restoreHiddenSecrets(item, base[index]));
  }
  if (draft && typeof draft === 'object') {
    const base =
      original && typeof original === 'object' && !Array.isArray(original)
        ? (original as Record<string, unknown>)
        : {};
    return Object.fromEntries(
      Object.entries(draft as Record<string, unknown>).map(([key, value]) => [
        key,
        restoreHiddenSecrets(value, base[key]),
      ])
    );
  }
  return draft;
}

/** YAML parses an unquoted `[hidden]` as a one-item sequence. */
function isHiddenMarker(value: unknown) {
  if (value === '[hidden]') return true;
  return Array.isArray(value) && value.length === 1 && value[0] === 'hidden';
}
