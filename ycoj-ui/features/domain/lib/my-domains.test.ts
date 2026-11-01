import {
  SYSTEM_DOMAIN_ID,
  buildMyDomainRows,
  domainHomePath,
  domainManagePath,
} from './my-domains';
import type { MyDomainsResponse } from '@/api/server/method/domain/types';
import { describe, expect, it } from 'vitest';

const data: MyDomainsResponse = {
  ddocs: [
    {
      _id: 'system',
      owner: 1,
      roles: {},
      avatar: '',
      bulletin: '',
      name: 'Hydro',
    },
    {
      _id: 'school',
      owner: 2,
      roles: {},
      avatar: '',
      bulletin: '',
      name: 'School',
    },
    {
      _id: 'team',
      owner: 9,
      roles: {},
      avatar: '',
      bulletin: '',
      name: 'Team',
    },
  ],
  role: { system: 'default', school: 'root', team: 'member' },
  canManage: { system: false, school: true, team: false },
  pinnedDomains: ['team'],
};

describe('my domain rows', () => {
  it('marks the active domain and derives its paths', () => {
    const rows = buildMyDomainRows(data, 9, 'school');
    const byId = Object.fromEntries(rows.map((row) => [row.domain._id, row]));
    expect(byId.school.active).toBe(true);
    expect(byId.team.active).toBe(false);
  });

  it('stars first, then sorts by name', () => {
    const rows = buildMyDomainRows(data, 9);
    expect(rows.map((row) => row.domain._id)).toEqual([
      'team',
      'system',
      'school',
    ]);
  });

  it('carries role and management state from the backend', () => {
    const [, system, school] = buildMyDomainRows(data, 9);
    expect(system.role).toBe('default');
    expect(system.canManage).toBe(false);
    expect(school.role).toBe('root');
    expect(school.canManage).toBe(true);
  });

  it('never offers leaving the system domain or an owned domain', () => {
    const rows = buildMyDomainRows(data, 9);
    const byId = Object.fromEntries(rows.map((row) => [row.domain._id, row]));
    expect(byId[SYSTEM_DOMAIN_ID].canLeave).toBe(false);
    expect(byId.team.canLeave).toBe(false);
    expect(byId.school.canLeave).toBe(true);
  });

  it('handles a missing star list', () => {
    const rows = buildMyDomainRows({ ...data, pinnedDomains: [] }, 1);
    expect(rows.every((row) => !row.starred)).toBe(true);
  });
});

describe('domain paths', () => {
  it('uses in-app routes for the active domain', () => {
    expect(domainHomePath('school', 'school')).toBe('/home');
    expect(domainManagePath('school', 'school')).toBe('/domain');
  });

  it('uses the backend domain prefix for other domains', () => {
    expect(domainHomePath('team', 'school')).toBe('/d/team/home');
    expect(domainManagePath('a b', 'school')).toBe('/d/a%20b/domain');
  });
});
