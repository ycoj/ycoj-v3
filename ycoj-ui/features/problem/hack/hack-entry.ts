import { STATUS } from '@/shared/configs/status';

export type HackEntryInput = {
  canHack: boolean;
  isSignedIn: boolean;
  problemHackable: boolean;
  recordUid: number;
  recordStatus: number;
  viewerUid?: number;
  problemPath: string;
  recordId: string;
  contest?: string;
};

/**
 * Decides whether the record detail page offers a Hack entry.
 *
 * Mirrors the backend guard in `ProblemHackHandler.prepare`: the problem must
 * be hackable, the target must be another user's accepted submission, and the
 * viewer must hold `PERM_SUBMIT_PROBLEM`. The backend re-checks everything when
 * the hack record is created, so this only controls the entry point.
 */
export function resolveHackHref(input: HackEntryInput): string | undefined {
  if (!input.canHack || !input.isSignedIn) return undefined;
  if (!input.problemHackable) return undefined;
  if (input.viewerUid === input.recordUid) return undefined;
  if (input.recordStatus !== STATUS.STATUS_ACCEPTED) return undefined;

  const target = `${input.problemPath}/hack/${input.recordId}`;
  if (input.contest) {
    return `${target}?${new URLSearchParams({ tid: input.contest }).toString()}`;
  }
  return target;
}
