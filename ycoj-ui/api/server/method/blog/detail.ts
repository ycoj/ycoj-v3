import { alova } from '@/api/server';
import type { Blog, BlogReply } from '@/shared/types/blog';
import type { Errorable } from '@/shared/types/error';
import type { BaseUser } from '@/shared/types/user';

/**
 * `GET /blog/:uid` — one author's posts, newest first.
 *
 * The backend paginates ten posts per page and returns `dpcount` from
 * `ctx.db.paginate`; a user without posts still gets `dpcount: 0`.
 */
export type BlogAuthor = BaseUser & { blogpic?: string };

export type BlogListResponse = {
  ddocs: Blog[];
  dpcount: number;
  /** `null` when the uid has no user (the handler still renders the list). */
  udoc: BlogAuthor | null;
  page: number;
};

export const getBlogList = (uid: number, page?: number) =>
  alova.Get<Errorable<BlogListResponse>>(`/blog/${uid}`, {
    params: page && page > 1 ? { page } : undefined,
  });

/**
 * `GET /blog/:uid/:did` — a single post with its replies.
 *
 * The handler returns `ddoc` (the complete blog document, including `reply`),
 * the caller's status document (`star`/`view`) and the author's user object.
 */
export type BlogStatus = {
  star?: boolean;
  view?: boolean;
};

export type BlogDetailResponse = {
  ddoc: Blog;
  dsdoc: BlogStatus | null;
  /** `null` when the post author no longer exists. */
  udoc: BlogAuthor | null;
};

export const getBlogDetail = (uid: number, did: string) =>
  alova.Get<Errorable<BlogDetailResponse>>(
    `/blog/${uid}/${encodeURIComponent(did)}`
  );

/** `GET /blog/:uid/:did/edit` — edit form prefilled with the post. */
export type BlogEditResponse = {
  ddoc: Blog;
};

export const getBlogEdit = (uid: number, did: string) =>
  alova.Get<Errorable<BlogEditResponse>>(
    `/blog/${uid}/${encodeURIComponent(did)}/edit`
  );

// Re-export the document type so page modules import it from the API layer.
export type { Blog, BlogReply };
