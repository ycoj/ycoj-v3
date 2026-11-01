import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type ProblemPackageFile = {
  name: string;
  size?: number;
};

/** The problem fields needed to rebuild a Hydro problem package. */
export type ProblemPackageDoc = {
  domainId: string;
  docId: number;
  pid?: string;
  owner: number;
  title: string;
  tag?: string[];
  nSubmit?: number;
  nAccept?: number;
  content?: string;
  data?: ProblemPackageFile[];
  additional_file?: ProblemPackageFile[];
};

const packageProjection = [
  'domainId',
  'docId',
  'pid',
  'owner',
  'title',
  'tag',
  'nSubmit',
  'nAccept',
  'content',
  'data',
  'additional_file',
] as const;

/**
 * Reads the full problem document for a package export through the `problem`
 * API operation. `domainId` in the arguments selects the owning domain; the
 * path stays unscoped so the `/api` rewrite (which strips `/api`) reaches it.
 */
export const getProblemPackageDoc = (domainId: string, id: number) =>
  clientRequest.Post<ProblemPackageDoc | Errorable<never>>('/api/problem', {
    args: { domainId, id },
    projection: packageProjection,
  });
