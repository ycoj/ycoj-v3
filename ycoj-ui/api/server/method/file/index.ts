import { alova } from '@/api/server';
import type { Errorable } from '@/shared/types/error';
import type { FileInfo } from '@/shared/types/file';

export type PersonalFilesResponse = Errorable<{ files: FileInfo[] }>;

/**
 * Loads the current user's personal file space.
 *
 * The handler requires file-creation privilege when the space is empty, so an
 * error response means the viewer may not create files.
 */
export const getPersonalFiles = () => alova.Get<PersonalFilesResponse>('/file');
