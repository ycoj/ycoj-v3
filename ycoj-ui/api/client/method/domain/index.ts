import {
  createDomain,
  joinDomain,
  leaveDomain,
  setDomainStar,
} from './account';
import {
  deleteDomain,
  initDiscussionNodes,
  saveDomainSettings,
} from './dashboard';
import { getGroupsByNames, searchGroups } from './groups';
import { deleteDomainGroup, updateDomainGroup } from './groups-admin';
import { saveDomainJoinApplications } from './join-applications';
import {
  createDomainRole,
  deleteDomainRoles,
  saveDomainPermissions,
} from './roles';
import { searchDomainsClient } from './search';
import { kickDomainUsers, setDomainUsers } from './users';

const Domain = {
  getGroupsByNames,
  searchGroups,
  createDomain,
  leaveDomain,
  setDomainStar,
  joinDomain,
  initDiscussionNodes,
  deleteDomain,
  saveDomainSettings,
  setDomainUsers,
  kickDomainUsers,
  createDomainRole,
  deleteDomainRoles,
  saveDomainPermissions,
  updateDomainGroup,
  deleteDomainGroup,
  saveDomainJoinApplications,
  searchDomainsClient,
};

export default Domain;
