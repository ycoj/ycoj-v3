import { alova } from '@/api/server';
import type {
  AuthPageError,
  LoginPageData,
  LostpassCodeData,
  RegisterCodeData,
} from '@/shared/types/auth';
import type { BackendError, SudoPageData } from '@/shared/types/sudo';

export const getSudoPage = () =>
  alova.Get<SudoPageData | BackendError>('/user/sudo', {
    cacheFor: 0,
  });

/**
 * Reads the public sign-in page payload, including the enabled providers and
 * whether username/password sign-in is offered.
 */
export const getLoginPage = () =>
  alova.Get<LoginPageData | AuthPageError>('/login', {
    cacheFor: 0,
  });

export const getRegisterToken = (code: string) =>
  alova.Get<RegisterCodeData | AuthPageError>(
    `/register/${encodeURIComponent(code)}`,
    { cacheFor: 0 }
  );

export const getLostpassToken = (code: string) =>
  alova.Get<LostpassCodeData | AuthPageError>(
    `/lostpass/${encodeURIComponent(code)}`,
    { cacheFor: 0 }
  );

const Auth = {
  getSudoPage,
  getLoginPage,
  getRegisterToken,
  getLostpassToken,
};
export default Auth;
