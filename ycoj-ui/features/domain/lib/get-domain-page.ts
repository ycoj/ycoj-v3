import 'server-only';
import ServerApis from '@/api/server/method';
import type {
  DomainDashboardResponse,
  DomainEditResponse,
  DomainGroupsResponse,
  DomainPermissionsResponse,
  DomainRolesResponse,
  DomainUsersResponse,
  JoinApplicationsResponse,
} from '@/api/server/method/domain/types';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import {
  BackendResponseError,
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { getTranslations } from 'next-intl/server';
import { redirect, unstable_rethrow } from 'next/navigation';
import { cache } from 'react';

export type DomainPageState<T> =
  { kind: 'data'; data: T } | { kind: 'error'; message: string };

export type DomainViewer = {
  id: number;
  canManage: boolean;
  canForceJoin: boolean;
  domainId: string;
  domainName: string;
};

/**
 * Loads the current domain and viewer facts once per request. Sudo-protected
 * pages redirect into the shared confirmation flow, and the backend replays the
 * request against the same new-UI route afterwards.
 */
export const getDomainViewer = cache(async (): Promise<DomainViewer> => {
  const [user, current] = await Promise.all([
    getUser(),
    ServerApis.Domain.getCurrentDomain(),
  ]);
  if (!user?._id) redirect('/login');
  const canManage = hasPerm(user, PERM.PERM_EDIT_DOMAIN);
  if (isSudoRequired(current)) redirect('/user/sudo');
  const domain = 'domain' in current ? current.domain : undefined;
  return {
    id: user._id,
    canManage,
    // Forcing a join additionally needs a global privilege or an open invite
    // policy; the admin form exposes it and the backend enforces the rest.
    canForceJoin: canManage,
    domainId: domain?._id ?? 'system',
    domainName: domain?.name ?? domain?._id ?? 'system',
  };
});

/**
 * Runs a domain GET and normalizes backend failures into a renderable state.
 * A sudo redirect is preserved rather than turned into an error page.
 */
export async function loadDomainPage<T>(
  load: () => Promise<T>,
  fallbackMessage: string
): Promise<DomainPageState<T>> {
  try {
    const response = await load();
    if (isSudoRequired(response)) redirect('/user/sudo');
    throwBackendError(response as object);
    return { kind: 'data', data: response };
  } catch (error) {
    unstable_rethrow(error);
    return {
      kind: 'error',
      message:
        error instanceof BackendResponseError && error.message
          ? error.message
          : fallbackMessage,
    };
  }
}

export async function getDomainDashboardPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<DomainDashboardResponse>(
    () => ServerApis.Domain.getDomainDashboard(),
    t('loadFailed')
  );
}

export async function getDomainEditPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<DomainEditResponse>(
    () => ServerApis.Domain.getDomainEdit(),
    t('loadFailed')
  );
}

export async function getDomainUsersPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<DomainUsersResponse>(
    () => ServerApis.Domain.getDomainUsers(),
    t('loadFailed')
  );
}

export async function getDomainRolesPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<DomainRolesResponse>(
    () => ServerApis.Domain.getDomainRoles(),
    t('loadFailed')
  );
}

export async function getDomainPermissionsPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<DomainPermissionsResponse>(
    () => ServerApis.Domain.getDomainPermissions(),
    t('loadFailed')
  );
}

export async function getDomainGroupsPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<DomainGroupsResponse>(
    () => ServerApis.Domain.getDomainGroups(),
    t('loadFailed')
  );
}

export async function getDomainJoinApplicationsPage() {
  const t = await getTranslations('domainAdmin');
  return loadDomainPage<JoinApplicationsResponse>(
    () => ServerApis.Domain.getDomainJoinApplications(),
    t('loadFailed')
  );
}
