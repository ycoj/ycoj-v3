import type { HydroError } from '@/shared/types/error';

/** Provider entry reported by the backend for third-party sign-in. */
export type LoginProvider = {
  id: string;
  text: string;
  name?: string;
  icon?: string;
};

export type LoginPageData = {
  redirect?: string;
  builtInLogin?: boolean;
  loginMethods?: LoginProvider[];
};

export type RegisterCodeData = {
  mail?: string;
  username?: string;
  lockUsername?: boolean;
};

export type LostpassCodeData = {
  uname?: string;
};

/** A public auth page that the backend could not serve. */
export type AuthPageError = { error: HydroError };
