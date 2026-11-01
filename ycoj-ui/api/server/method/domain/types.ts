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

export type MyDomainsResponse = {
  ddocs: DomainDoc[];
  /** Whether the caller can manage each domain id. */
  canManage: Record<string, boolean>;
  /** Caller's role per domain id. */
  role: Record<string, string>;
  /** Domains the caller starred for quick access. */
  pinnedDomains: string[];
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

export type JoinMethod = 0 | 1 | 2;

/** Stored join policy. `expire` is an ISO date string when finite. */
export type JoinSettings = {
  method: JoinMethod;
  role?: string;
  group?: string;
  expire?: string | null;
  code?: string;
};

export type JoinApplicationsResponse = {
  rolesWithText?: [string, string][];
  joinSettings?: JoinSettings;
  /** Expiration preset hours mapped to the backend's English labels. */
  expirations: Record<string, string>;
  url_prefix?: string;
};

export type DomainJoinInfo = {
  name: string;
  owner: DomainOwner;
  avatar?: string;
  bulletin?: string;
};

export type DomainJoinResponse = {
  joinSettings?: JoinSettings;
  code: string;
  redirect: string;
  target: string;
  domainInfo: DomainJoinInfo;
};

export type DomainSearchItem = {
  _id: string;
  name: string;
  avatarUrl: string;
};

export type CurrentDomainResponse = {
  domain: DomainDoc;
};

export type DomainMutationResponse =
  BackendRedirect | BackendError | Record<string, unknown>;

export type DomainGetResponse<T> = T | BackendError | BackendRedirect;
