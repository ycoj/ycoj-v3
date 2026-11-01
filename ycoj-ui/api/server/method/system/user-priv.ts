import { alova } from '@/api/server';

export type SystemUserPrivAccount = {
  _id: number;
  uname: string;
  mail?: string;
  avatar?: string;
  priv: number;
};

export type SystemUserPrivResponse = {
  udocs: SystemUserPrivAccount[];
  defaultPriv: number;
  /** Named global privilege bits, excluding the special mask values. */
  Priv: Record<string, number>;
};

/**
 * GET /manage/userpriv — requires PRIV_EDIT_SYSTEM and sudo.
 * `extraIgnore` hides accounts whose privilege exactly matches a listed value.
 */
export const getUserPrivileges = (extraIgnore: number[] = []) =>
  alova.Get<SystemUserPrivResponse>('/manage/userpriv', {
    params: extraIgnore.length
      ? { extraIgnore: extraIgnore.join(',') }
      : undefined,
    cacheFor: 0,
  });
