import type { MyDomainsResponse } from '@/api/server/method/domain/types';
import type { DomainDoc } from '@/shared/types/domain';

export const SYSTEM_DOMAIN_ID = 'system';

export type MyDomainRow = {
  domain: DomainDoc;
  role: string;
  canManage: boolean;
  starred: boolean;
  /** The owner cannot leave their own domain; system is never leavable. */
  canLeave: boolean;
  /** True when this row is the domain the current request is rendered in. */
  active: boolean;
};

/**
 * Joins the domain list with role, manage permission, and star state into the
 * rows the "My domains" table renders. Starred rows sort first, then by name.
 */
export function buildMyDomainRows(
  data: MyDomainsResponse,
  userId: number,
  activeDomainId = SYSTEM_DOMAIN_ID
): MyDomainRow[] {
  const pinned = new Set(data.pinnedDomains ?? []);
  return data.ddocs
    .map((domain) => ({
      domain,
      role: data.role[domain._id] ?? 'default',
      canManage: Boolean(data.canManage[domain._id]),
      starred: pinned.has(domain._id),
      canLeave: domain._id !== SYSTEM_DOMAIN_ID && domain.owner !== userId,
      active: domain._id === activeDomainId,
    }))
    .sort((a, b) => {
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      return String(a.domain.name ?? a.domain._id).localeCompare(
        String(b.domain.name ?? b.domain._id)
      );
    });
}

export function domainDisplayName(domain: DomainDoc) {
  const name = typeof domain.name === 'string' ? domain.name : '';
  return name || domain._id;
}

/**
 * The new UI only renders the active domain. Other domains are selected with
 * the backend's `/d/{id}` prefix, which a deployment must route to the backend
 * (the Next app has no matching route), so these links force a full page load
 * instead of a client navigation.
 */
export function isSameDomain(domainId: string, activeDomainId: string) {
  return domainId === activeDomainId;
}

/** Target path for a domain's homepage. */
export function domainHomePath(domainId: string, activeDomainId: string) {
  return isSameDomain(domainId, activeDomainId)
    ? '/home'
    : `/d/${encodeURIComponent(domainId)}/home`;
}

/** Target path for a domain's management console. */
export function domainManagePath(domainId: string, activeDomainId: string) {
  return isSameDomain(domainId, activeDomainId)
    ? '/domain'
    : `/d/${encodeURIComponent(domainId)}/domain`;
}
