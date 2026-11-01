import type { Blog } from '@/shared/types/blog';
import dayjs from 'dayjs';

export type BlogFormValues = {
  title: string;
  content: string;
};

/** `Types.Title` caps a title at 64 characters; `Types.Content` requires text. */
export const BLOG_TITLE_MAX_LENGTH = 64;

export type BlogValidationMessages = {
  titleRequired: string;
  titleTooLong: string;
  contentRequired: string;
};

export function validateBlogValues(
  values: BlogFormValues,
  messages: BlogValidationMessages
): Partial<Record<keyof BlogFormValues, string>> {
  const errors: Partial<Record<keyof BlogFormValues, string>> = {};
  const title = values.title.trim();
  const content = values.content.trim();

  if (!title) errors.title = messages.titleRequired;
  else if (title.length > BLOG_TITLE_MAX_LENGTH) {
    errors.title = messages.titleTooLong;
  }
  if (!content) errors.content = messages.contentRequired;

  return errors;
}

/** Payload accepted by both `postCreate` and `postUpdate`. */
export function buildBlogPayload(values: BlogFormValues): BlogFormValues {
  return {
    title: values.title.trim(),
    content: values.content.trim(),
  };
}

/**
 * The blog model stores no creation timestamp, so the post id's ObjectId time
 * stamp (first four bytes, seconds) is the published time the legacy list
 * displayed. Returns `null` for an id that is not a 24-hex ObjectId.
 */
export function getBlogPublishedAt(docId: string): Date | null {
  if (!/^[0-9a-fA-F]{24}$/.test(docId)) return null;
  const seconds = Number.parseInt(docId.slice(0, 8), 16);
  if (!Number.isSafeInteger(seconds)) return null;
  const date = dayjs(seconds * 1000);
  return date.isValid() ? date.toDate() : null;
}

export function blogDetailPath(uid: number, did: string): string {
  return `/blog/${uid}/${did}`;
}

export function blogEditPath(uid: number, did: string): string {
  return `/blog/${uid}/${did}/edit`;
}

export function blogCreatePath(uid: number): string {
  return `/blog/${uid}/create`;
}

export function blogListPath(uid: number): string {
  return `/blog/${uid}`;
}

/**
 * The edit route is gated by `PRIV_USER_PROFILE`; the handler itself only
 * authorizes `postUpdate`/`postDelete` for the author or a system editor, but
 * showing the link earlier avoids a dead end for everyone else.
 */
export function canEditBlog(
  viewerId: number | undefined,
  blog: Pick<Blog, 'owner'>,
  isSystemEditor: boolean
): boolean {
  if (isSystemEditor) return true;
  return viewerId !== undefined && viewerId === blog.owner;
}

/** Only the author can create a post on their own blog. */
export function canCreateBlog(
  viewerId: number | undefined,
  uid: number
): boolean {
  return viewerId !== undefined && viewerId === uid;
}
