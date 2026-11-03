import { initDiscussionNodes, saveDomainSettings } from './dashboard';
import { getGroupsByNames, searchGroups } from './groups';
import { deleteDomainGroup, updateDomainGroup } from './groups-admin';
import {
  createDomainRole,
  deleteDomainRoles,
  saveDomainPermissions,
} from './roles';
import { kickDomainUsers, setDomainUsers } from './users';

const Domain = {
  getGroupsByNames,
  searchGroups,
  initDiscussionNodes,
  saveDomainSettings,
  setDomainUsers,
  kickDomainUsers,
  createDomainRole,
  deleteDomainRoles,
  saveDomainPermissions,
  updateDomainGroup,
  deleteDomainGroup,
};

export default Domain;
