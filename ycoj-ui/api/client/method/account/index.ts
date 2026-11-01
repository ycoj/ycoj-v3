import { requestAccountDeletion } from './delete-account';
import {
  changeMail,
  changePassword,
  deleteAllSessions,
  deleteSession,
  disableTfa,
  disableWebauthn,
  enableTfa,
  enableWebauthn,
  startWebauthnRegistration,
} from './security';
import {
  saveAccountSettings,
  saveUserSettings,
  updateAvatar,
  uploadAvatar,
} from './settings';

const Account = {
  changeMail,
  changePassword,
  deleteAllSessions,
  deleteSession,
  disableTfa,
  disableWebauthn,
  enableTfa,
  enableWebauthn,
  startWebauthnRegistration,
  saveAccountSettings,
  saveUserSettings,
  updateAvatar,
  uploadAvatar,
  requestAccountDeletion,
};

export default Account;
