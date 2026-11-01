import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

/** `POST /blog/:uid/:did` with `operation: 'star' | 'unstar'`. */
export type BlogStarResponse = Errorable<{ url?: string; star?: boolean }>;

export const starBlog = (uid: number, did: string) =>
  clientRequest.Post<BlogStarResponse>(
    `/blog/${uid}/${encodeURIComponent(did)}`,
    { operation: 'star', did }
  );

export const unstarBlog = (uid: number, did: string) =>
  clientRequest.Post<BlogStarResponse>(
    `/blog/${uid}/${encodeURIComponent(did)}`,
    { operation: 'unstar', did }
  );
