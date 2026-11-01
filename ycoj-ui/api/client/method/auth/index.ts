import { login } from './login';
import { logout } from './logout';
import { requestPasswordReset, resetPassword } from './lostpass';
import { completeRegistration, startRegistration } from './register';
import {
  confirmSudo,
  getWebauthnOptions,
  verifyWebauthn,
  resumeSudoAction,
} from './sudo';
import { getTfaMethods } from './tfa';
import { getLoginWebauthnOptions, submitWebauthnAssertion } from './webauthn';

const Auth = {
  login,
  logout,
  confirmSudo,
  getWebauthnOptions,
  verifyWebauthn,
  resumeSudoAction,
  getTfaMethods,
  getLoginWebauthnOptions,
  submitWebauthnAssertion,
  startRegistration,
  completeRegistration,
  requestPasswordReset,
  resetPassword,
};

export default Auth;
