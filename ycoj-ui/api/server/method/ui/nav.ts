import { alova } from '@/api/server';
import type { User } from '@/shared/types/user';

type NavItemArgs = {
  prefix?: string;
  displayName?: string;
  before?: string;
  query?: Record<string, unknown>;
  [key: string]: unknown;
};

export type NavItem = {
  name: string;
  args: NavItemArgs;
};

export type NavInfoResponse = {
  navItems: NavItem[];
  user: User;
};

export const getNavInfos = () => alova.Get<NavInfoResponse>('/ui/nav');
