import type { ObjectId } from '@/shared/types/shared';

/** Absolute upload origin, or an empty string to route through the Next proxy. */
export const uploadBaseUrl = () =>
  process.env.NEXT_PUBLIC_UPLOAD_BASEURL?.replace(/\/+$/, '') ?? '';

/**
 * Request config for multipart uploads that may target a different origin.
 *
 * Login is proxied through Next.js, so the host-scoped session cookie is not
 * available to a different upload host. Hydro also accepts sid as a query.
 */
export const uploadRequestConfig = (url: string, tid?: ObjectId) => {
  const params: Record<string, string> = tid ? { tid } : {};
  if (
    typeof window === 'undefined' ||
    new URL(url, window.location.origin).host === window.location.host
  ) {
    return { params };
  }

  const sid = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('sid='))
    ?.slice('sid='.length);

  return sid ? { params: { ...params, sid } } : { params };
};
