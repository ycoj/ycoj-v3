import type { DomainDoc } from '@/shared/types/domain';
import type { BackendError, BackendRedirect } from '@/shared/types/sudo';

export type DomainOwner = {
  _id: number;
  uname: string;
  /** Owner documents are full user summaries at runtime. */
  mail: string;
  avatar: string;
  displayName?: string;
};

export type DomainRoleDoc = {
  _id: string;
  /** Serialized bigint, e.g. `BigInt::255`. */
  perm: string;
  count?: number;
};

export type DomainUserDoc = {
  _id: number;
  uname: string;
  /** Member listings carry the full user summary at runtime. */
  mail: string;
  avatar: string;
  role?: string;
  join?: boolean;
  displayName?: string;
};

export type DomainGroupDoc = {
  _id?: string;
  name: string;
  uids?: number[];
};

export type DomainDashboardResponse = {
  domain: DomainDoc;
  owner: DomainOwner;
};

export type DomainSetting = {
  family: string;
  key: string;
  value: unknown;
  type: string;
  name: string;
  desc?: string | null;
  flag: number;
  subType?: string;
  range?: [string, string][] | Record<string, string> | null;
};

export type DomainEditResponse = {
  current: DomainDoc;
  settings: DomainSetting[];
};

export type DomainUsersResponse = {
  roles: DomainRoleDoc[];
  /** Members grouped by role id. */
  rudocs: Record<string, DomainUserDoc[]>;
  domain: DomainDoc;
};

export type DomainRolesResponse = {
  roles: DomainRoleDoc[];
  domain: DomainDoc;
};

export type DomainPermission = {
  family: string;
  /** Serialized bigint power of two, e.g. `BigInt::1`. */
  key: string;
  desc: string;
};

export type DomainPermissionsResponse = {
  roles: DomainRoleDoc[];
  PERMS_BY_FAMILY: Record<string, DomainPermission[]>;
  domain: DomainDoc;
};

export type DomainGroupsResponse = {
  domain: DomainDoc;
  groups: DomainGroupDoc[];
};

export type CurrentDomainResponse = {
  domain: DomainDoc;
};

export type DomainMutationResponse =
  BackendRedirect | BackendError | Record<string, unknown>;

export type DomainGetResponse<T> = T | BackendError | BackendRedirect;
