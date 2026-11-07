import type {
  CurrentDomainResponse,
  DomainCoinsResponse,
  DomainDashboardResponse,
  DomainEditResponse,
  DomainGroupsResponse,
  DomainPermissionsResponse,
  DomainRolesResponse,
  DomainUsersResponse,
} from './types';
import { alova } from '@/api/server';

/**
 * Domain-management routes are resolved against the active request domain.
 * Keeping them unprefixed is what makes sudo continuation work: the backend
 * replays the stored request against the same path, and the new UI serves it
 * as the same route.
 */
export const getCurrentDomain = () =>
  alova.Get<CurrentDomainResponse>('/api/domain.current', { cacheFor: 0 });

export const getDomainDashboard = () =>
  alova.Get<DomainDashboardResponse>('/domain/dashboard', { cacheFor: 0 });

export const getDomainEdit = () =>
  alova.Get<DomainEditResponse>('/domain/edit', { cacheFor: 0 });

export const getDomainUsers = () =>
  alova.Get<DomainUsersResponse>('/domain/user', { cacheFor: 0 });

export const getDomainRoles = () =>
  alova.Get<DomainRolesResponse>('/domain/role', { cacheFor: 0 });

export const getDomainPermissions = () =>
  alova.Get<DomainPermissionsResponse>('/domain/permission', {
    cacheFor: 0,
  });

export const getDomainGroups = () =>
  alova.Get<DomainGroupsResponse>('/domain/group', { cacheFor: 0 });

export const getDomainCoins = () =>
  alova.Get<DomainCoinsResponse>('/domain/coins', { cacheFor: 0 });
