/* eslint-disable @typescript-eslint/no-explicit-any */

export interface DomainDoc extends Record<string, any> {
  _id: string;
  owner: number;
  roles: Record<string, any>;
  avatar: string;
  bulletin: string;
  host?: string[];
}
