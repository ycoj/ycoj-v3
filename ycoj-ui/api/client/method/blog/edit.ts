import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';
import type { ObjectId } from '@/shared/types/shared';

export type BlogMutationResponse = Errorable<{ url?: string; did?: ObjectId }>;

/**
 * Blog writes live on the edit handler (`/blog/:uid/:did/edit`), not the detail
 * route: `postCreate`, `postUpdate`, `postDelete`. Create is called on the
 * create page, which uses the same handler without a `did`.
 *
 * The handler redirects to `/blog/:uid/:did` for create/update with the *post
 * author's* uid, so the caller supplies the uid it already knows.
 */
export const createBlog = (uid: number, title: string, content: string) =>
  clientRequest.Post<BlogMutationResponse>(`/blog/${uid}/create`, {
    operation: 'create',
    title,
    content,
  });

export const updateBlog = (
  uid: number,
  did: string,
  title: string,
  content: string
) =>
  clientRequest.Post<BlogMutationResponse>(
    `/blog/${uid}/${encodeURIComponent(did)}/edit`,
    { operation: 'update', did, title, content }
  );

export const deleteBlog = (uid: number, did: string) =>
  clientRequest.Post<BlogMutationResponse>(
    `/blog/${uid}/${encodeURIComponent(did)}/edit`,
    { operation: 'delete', did }
  );
