'server-only';

import ServerApis from '@/api/server/method';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';

export type SubmitPreferences = {
  /** Preferred code language, e.g. `cc.cc14o2` or a family key. */
  codeLang?: string;
  /** Preferred starting source text. */
  codeTemplate?: string;
};

/**
 * Loads the account-level submission preferences.
 *
 * `/ui/nav` only exposes public user fields, so the code preferences are read
 * from the preference settings page, whose `current` object is the private
 * user record. Guests and users without a profile have no preferences.
 */
export async function getSubmitPreferences(
  user: User | null | undefined
): Promise<SubmitPreferences> {
  if (!user?._id || !hasPriv(user, PRIV.PRIV_USER_PROFILE)) return {};

  try {
    const response = await ServerApis.Account.getUserSettings('preference');
    if ('url' in response || 'error' in response) return {};

    const current = response.current as Record<string, unknown>;
    const codeLang =
      typeof current.codeLang === 'string' && current.codeLang
        ? current.codeLang
        : undefined;
    const codeTemplate =
      typeof current.codeTemplate === 'string' && current.codeTemplate
        ? current.codeTemplate
        : undefined;
    return { codeLang, codeTemplate };
  } catch {
    // Preferences are optional; the form falls back to its default language.
    return {};
  }
}
