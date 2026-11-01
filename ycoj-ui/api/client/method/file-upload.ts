import { uploadClientRequest } from '@/api/client';

export const getUploadBaseUrl = () =>
  process.env.NEXT_PUBLIC_UPLOAD_BASEURL?.replace(/\/+$/, '') ?? '';

/**
 * Points uploads at the configured backend while keeping the request usable
 * from a different upload host. Login is proxied through Next.js, so its
 * host-scoped session cookie is unavailable there; Hydro also accepts `sid` as
 * a query parameter for these requests.
 */
export const buildUploadConfig = (url: string) => {
  if (
    typeof window === 'undefined' ||
    new URL(url, window.location.origin).host === window.location.host
  ) {
    return {};
  }

  const sid = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('sid='))
    ?.slice('sid='.length);

  return sid ? { params: { sid } } : {};
};

/** Posts a multipart file operation through the XHR adapter for progress. */
export const uploadFormFile = <T>(url: string, form: FormData) =>
  uploadClientRequest.Post<T>(url, form, buildUploadConfig(url));
