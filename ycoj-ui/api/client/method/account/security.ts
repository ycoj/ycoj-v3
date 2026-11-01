import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';

export type SecurityMutationResponse = Errorable<{ url: string }>;

export type WebauthnRegistrationOptionsResponse =
  | { authOptions?: PublicKeyCredentialCreationOptionsJSON }
  | Errorable<{ url: string }>;

export const deleteSession = (tokenDigest: string) =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'deleteToken',
    tokenDigest,
  });

export const deleteAllSessions = () =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'deleteAllTokens',
  });

export const changePassword = (
  current: string,
  password: string,
  verifyPassword: string
) =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'changePassword',
    current,
    password,
    verifyPassword,
  });

export const changeMail = (password: string, mail: string) =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'changeMail',
    password,
    mail,
  });

export const disableTfa = () =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'disableTfa',
  });

export const enableTfa = (code: string, secret: string) =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'enableTfa',
    code,
    secret,
  });

export const startWebauthnRegistration = (
  type: 'cross-platform' | 'platform'
) =>
  clientRequest.Post<WebauthnRegistrationOptionsResponse>(
    '/home/security',
    { operation: 'register', type },
    { cacheFor: 0 }
  );

export const enableWebauthn = (
  name: string,
  result: RegistrationResponseJSON
) =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'enableAuthn',
    name,
    result,
  });

export const disableWebauthn = (id: string) =>
  clientRequest.Post<SecurityMutationResponse>('/home/security', {
    operation: 'disableAuthn',
    id,
  });
