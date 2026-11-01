import { clientRequest } from '@/api/client';
import type { DomainSearchItem } from '@/api/server/method/domain/types';

/** Client-side domain autocomplete used by the join flow and search page. */
export const searchDomainsClient = (q: string) =>
  clientRequest.Get<DomainSearchItem[]>('/domain/search', {
    params: { q },
    cacheFor: 0,
  });
