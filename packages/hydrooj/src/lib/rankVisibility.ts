/**
 * Leaderboard visibility for users who enabled the `hideRank` account setting.
 *
 * Opting out only shapes the *listing*. `calcLevel` in `script/rating.ts` keeps
 * computing RP and rank for every user, so a hidden user never loses points and
 * becomes visible again as soon as the setting is turned off.
 */

/**
 * The complete `uid` clause for a leaderboard listing, to be spread into the
 * query: it excludes the system/guest accounts and everyone who opted out.
 *
 * The `$nin` clause is omitted when nobody opted out, so the common case keeps
 * the original query shape (and its index usage) untouched.
 *
 * Callers must first collect the opted-out uids with
 * `user.getRankHiddenUids()`. That lookup is uncached and grows with the number
 * of opted-in users, and it runs on every leaderboard request; if opt-out counts
 * ever get large, denormalizing the flag onto `domain.user` removes the lookup
 * and the `$nin` entirely.
 */
export function leaderboardUidClause(hiddenUids: number[]) {
    return hiddenUids.length
        ? { uid: { $gt: 1, $nin: hiddenUids } }
        : { uid: { $gt: 1 } };
}
