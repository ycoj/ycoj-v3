import type { PublicProjectionProblem } from '@/shared/types/problem';

/** Backend `limit.codelength` fallback for inline source; see ProblemSubmitHandler. */
export const DEFAULT_CODE_LENGTH_LIMIT = 128 * 1024;

/** Backend cap for answer-file problems (`submit_answer`). */
export const ANSWER_FILE_SIZE_LIMIT = 128 * 1024 * 1024;

export type SubmitMode = 'code' | 'file' | 'answer';

export type SubmitModeInfo = {
  /** Which input the form should show. */
  mode: SubmitMode;
  /** Maximum inline source length in characters. */
  codeLimit: number;
  /** Maximum upload size in bytes. */
  fileLimit: number;
  /** The backend ignores the language for these types and forces `_`. */
  fixedLanguage: boolean;
};

/**
 * Resolves how the standalone submit form should accept a solution.
 *
 * Answer problems only work through a file upload, while every other problem
 * type accepts pasted source. Archives and binaries are uploaded in code mode
 * as well, so that mode keeps a file input.
 */
export function resolveSubmitMode(
  problem: Pick<PublicProjectionProblem, 'config'>
): SubmitModeInfo {
  const type = problem.config?.type;
  const isAnswer = type === 'submit_answer';
  return {
    mode: isAnswer ? 'answer' : 'code',
    codeLimit: DEFAULT_CODE_LENGTH_LIMIT,
    fileLimit: isAnswer ? ANSWER_FILE_SIZE_LIMIT : DEFAULT_CODE_LENGTH_LIMIT,
    fixedLanguage: isAnswer,
  };
}

/** Formats a byte limit for user-facing copy. */
export function formatSizeLimit(bytes: number): string {
  if (bytes >= 1024 ** 2) {
    const mib = bytes / 1024 ** 2;
    return `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB`;
  }
  if (bytes >= 1024) {
    const kib = bytes / 1024;
    return `${Number.isInteger(kib) ? kib : kib.toFixed(1)} KiB`;
  }
  return `${bytes} B`;
}

export type LanguageSelection = { familyKey: string; lang: string };

type LanguageFamilies = Record<string, { versions: Array<{ name: string }> }>;

/**
 * Picks the initial language family and version from the account preference.
 *
 * Mirrors the legacy submit page: try the exact version, then its language
 * family, then the built-in C++ default, then the first allowed language. A
 * stored local choice still wins because the form only uses this as its
 * default value.
 */
export function resolvePreferredSelection(
  languages: LanguageFamilies,
  preferred?: string
): LanguageSelection {
  const familyKeys = Object.keys(languages);
  if (!familyKeys.length) return { familyKey: '', lang: '' };

  if (preferred) {
    const preferredFamily = preferred.split('.')[0];
    const family = languages[preferredFamily];
    if (family) {
      const exact = family.versions.find(
        (version) => version.name === preferred
      );
      return {
        familyKey: preferredFamily,
        lang: exact?.name ?? family.versions[0]?.name ?? '',
      };
    }

    // A version key that is grouped under a different family.
    for (const familyKey of familyKeys) {
      const match = languages[familyKey].versions.find(
        (version) => version.name === preferred
      );
      if (match) return { familyKey, lang: match.name };
    }
  }

  const cpp = languages['cc'];
  if (cpp) {
    const defaultVersion = cpp.versions.find(
      (version) => version.name === 'cc.cc14o2'
    );
    return {
      familyKey: 'cc',
      lang: defaultVersion?.name ?? cpp.versions[0]?.name ?? '',
    };
  }

  const firstFamily = familyKeys[0];
  return {
    familyKey: firstFamily,
    lang: languages[firstFamily].versions[0]?.name ?? '',
  };
}

/**
 * Maps a backend redirect path onto the frontend route space.
 *
 * Legacy paths such as `/p/P1000` are rewritten by `next.config.ts`; a client
 * navigation must use the target route directly so it does not rely on the
 * rewrite. Domain-prefixed paths (`/d/<id>/...`) are rejected because the new
 * UI has no domain prefix handling on these routes.
 */
export function normalizeAppUrl(url?: string): string | undefined {
  if (!url || !url.startsWith('/') || url.startsWith('//')) return undefined;
  const path = url.replace(/^\/d\/[^/]+(?=\/)/, '');
  if (!path) return undefined;
  return path.replace(/^\/p(?=\/|$)/, '/problem');
}
