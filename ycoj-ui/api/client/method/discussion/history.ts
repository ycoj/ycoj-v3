import { clientRequest } from '@/api/client';
import type { ObjectId } from '@/shared/types/shared';

export type DiscussionHistoryEntry = {
  content: string;
  time: string;
  uid: number;
  docId?: ObjectId;
  title?: string;
};

export type DiscussionHistoryResponse = {
  history: DiscussionHistoryEntry[];
};

/**
 * Fetches the full edit history. The raw route answers with JSON only for
 * `all=1`; the single-version mode returns `text/markdown`.
 */
export const getDiscussionHistory = (
  did: ObjectId,
  drid?: ObjectId,
  drrid?: ObjectId
) => {
  const path = drrid
    ? `/discuss/${did}/${drid}/${drrid}/raw`
    : drid
      ? `/discuss/${did}/${drid}/raw`
      : `/discuss/${did}/raw`;
  return clientRequest.Get<DiscussionHistoryResponse>(path, {
    params: { all: 1 },
  });
};
