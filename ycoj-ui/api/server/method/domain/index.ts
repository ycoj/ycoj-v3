import { getMyDomains } from './my-domains';
import {
  getCurrentDomain,
  getDomainDashboard,
  getDomainEdit,
  getDomainGroups,
  getDomainJoin,
  getDomainJoinApplications,
  getDomainPermissions,
  getDomainRoles,
  getDomainUsers,
  searchDomains,
} from './routes';

const Domain = {
  getMyDomains,
  getCurrentDomain,
  getDomainDashboard,
  getDomainEdit,
  getDomainUsers,
  getDomainRoles,
  getDomainPermissions,
  getDomainGroups,
  getDomainJoinApplications,
  getDomainJoin,
  searchDomains,
};

export default Domain;
