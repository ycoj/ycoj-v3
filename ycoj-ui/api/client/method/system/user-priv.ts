import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type UpdateUserPrivilegeResponse = Errorable<{ url: string }>;

export type UpdateUserPrivilegeBody =
  | { uid: number; priv: number; system?: false }
  | { uid: number; priv: number; system: true };

/**
 * POST /manage/userpriv.
 * A normal update targets one account; `system: true` rewrites the default
 * privilege and every account still using the previous default.
 */
export const updateUserPrivilege = (body: UpdateUserPrivilegeBody) =>
  clientRequest.Post<UpdateUserPrivilegeResponse>('/manage/userpriv', body);

export type UserPrivDetail = {
  _id: number;
  uname: string;
  priv: number;
};

type UserDetailResponse = { udoc: UserPrivDetail };

/**
 * GET /user/:uid — used to open an account picked from search.
 * `uidOrName` accepts a numeric UID or a username; the backend validates it.
 */
export const getUserPrivDetail = (uidOrName: string | number) =>
  clientRequest.Get<Errorable<UserDetailResponse>>(
    `/user/${encodeURIComponent(String(uidOrName))}`
  );

const SystemUserPriv = { updateUserPrivilege, getUserPrivDetail };
export default SystemUserPriv;
