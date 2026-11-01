import { hasPriv, PRIV } from '@/features/user/lib/priv';
import type { User } from '@/shared/types/user';

/** Uploading to the personal file space requires the file-creation privilege. */
export function canUploadPersonalFiles(user: User | null | undefined): boolean {
  if (!user?._id) return false;
  return hasPriv(user, PRIV.PRIV_CREATE_FILE);
}
