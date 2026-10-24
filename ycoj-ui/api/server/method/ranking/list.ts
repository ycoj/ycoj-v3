import { alova } from '@/api/server';
import type { BaseUser, RpInfo } from '@/shared/types/user';

export type RankingSort = 'rp' | 'rating';

export type RankingUser = BaseUser & {
  /** Rating Points */
  rp: number;
  /** Rating points details */
  rpInfo?: RpInfo;
  /** Number of accepted problems */
  nAccept: number;
  /** User bio (Markdown format) */
  bio: string | null;
  /** Current user's rank (only present when user has PRIV_USER_PROFILE permission) */
  rank?: number;
};

export type RankingListResponse = {
  /** Current page number */
  page: number;
  /** User list */
  udocs: RankingUser[];
  /** Total number of pages */
  upcount: number;
  /** Total number of users */
  ucount: number;
  /** Page size */
  pageSize: number;
  sort: RankingSort;
  selfRank: number | null;
};

export const getRankingList = (page?: number, sort: RankingSort = 'rp') =>
  alova.Get<RankingListResponse>('/ranking', {
    params: { page, sort },
  });
