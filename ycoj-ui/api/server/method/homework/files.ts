import { alova } from '@/api/server';
import type { HomeworkDetailTdoc } from '@/api/server/method/homework/detail';
import type { Errorable } from '@/shared/types/error';
import type { FileInfo } from '@/shared/types/file';
import type { HomeworkStatus } from '@/shared/types/homework';
import type { BaseUser } from '@/shared/types/user';

export type HomeworkFilesData = {
  tdoc: HomeworkDetailTdoc;
  tsdoc: HomeworkStatus | null;
  udoc: BaseUser;
  files: FileInfo[];
};

export type HomeworkFilesResponse = Errorable<HomeworkFilesData>;

/**
 * Loads the homework attachments the current user may manage.
 *
 * @param tid Homework identifier.
 */
export const getHomeworkFiles = (tid: string) =>
  alova.Get<HomeworkFilesResponse>(`/homework/${tid}/file`);
