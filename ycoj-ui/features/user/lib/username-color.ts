import type { BaseUser } from '@/shared/types/user';

export function getRatingTier(rating?: number | null) {
  if (rating == null || !Number.isFinite(rating)) return 'unrated';
  if (rating < 1200) return 'newbie';
  if (rating < 1400) return 'pupil';
  if (rating < 1600) return 'specialist';
  if (rating < 1900) return 'expert';
  if (rating < 2100) return 'candidateMaster';
  if (rating < 2400) return 'master';
  if (rating < 3000) return 'grandmaster';
  return 'legendaryGrandmaster';
}

const RATING_COLORS = {
  unrated: 'text-foreground',
  newbie: 'text-zinc-600 dark:text-zinc-400',
  pupil: 'text-green-700 dark:text-green-400',
  specialist: 'text-teal-700 dark:text-teal-400',
  expert: 'text-blue-700 dark:text-blue-400',
  candidateMaster: 'text-purple-700 dark:text-purple-400',
  master: 'text-orange-700 dark:text-orange-400',
  grandmaster: 'text-red-700 dark:text-red-400',
  legendaryGrandmaster: 'text-red-700 dark:text-red-400',
} as const;

export default function getUsernameColor(
  user: Pick<BaseUser, 'contestRating'>
) {
  return RATING_COLORS[getRatingTier(user.contestRating?.rating)];
}
