import { hasPerm, hasPriv, PERM, PRIV } from '@/features/user/lib/priv';
import type { HomeworkStatus } from '@/shared/types/homework';
import type { User } from '@/shared/types/user';

type HomeworkForRecordCheck = {
  owner: number;
  maintainer?: number[];
};

/**
 * Matches the legacy homework sidebar gate for the code export and the
 * all-submissions entry: the owner/maintainers, or anyone who can read
 * submission code.
 */
export function canReadHomeworkRecords(
  user: User | null | undefined,
  tdoc: HomeworkForRecordCheck
): boolean {
  if (!user?._id) return false;
  const owns =
    user._id === tdoc.owner || (tdoc.maintainer?.includes(user._id) ?? false);
  return (
    owns ||
    hasPriv(user, PRIV.PRIV_READ_RECORD_CODE) ||
    hasPerm(user, PERM.PERM_READ_RECORD_CODE)
  );
}

/**
 * Returns the record entries the sidebar should offer: the all-submissions
 * entry for code readers, otherwise the viewer's own submissions once they
 * have joined the homework.
 */
export function getHomeworkRecordEntries(
  user: User | null | undefined,
  tdoc: HomeworkForRecordCheck,
  tsdoc: HomeworkStatus | null | undefined
): { all: boolean; own: boolean } {
  if (!user?._id) return { all: false, own: false };
  if (canReadHomeworkRecords(user, tdoc)) return { all: true, own: false };
  return { all: false, own: Boolean(tsdoc?.attend) };
}
