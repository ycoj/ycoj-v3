import type { ProblemDetailMode } from '@/api/server/method/problems/detail';

export type ContestEndedVariant = 'view' | 'correction';

/**
 * Contest context after the contest is over, mirroring the legacy UI:
 * `view` means the contest submission is gone, `correction` means later
 * submissions count as corrections. Both show a notice and swap the sidebar
 * submit entry for "Open in Problem Set".
 */
export function getContestEndedVariant(
  mode: ProblemDetailMode | undefined
): ContestEndedVariant | null {
  if (mode === 'view' || mode === 'correction') return mode;
  return null;
}
