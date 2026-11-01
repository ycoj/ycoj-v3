import { alova } from '@/api/server';
import type { Errorable } from '@/shared/types/error';
import type { FileInfo } from '@/shared/types/file';
import type {
  TrainingDoc,
  TrainingStatusFields,
} from '@/shared/types/training';
import type { StatusDocBase } from '@/shared/types/training';
import type { BaseUser } from '@/shared/types/user';

export type TrainingFilesData = {
  tdoc: TrainingDoc;
  tsdoc: (StatusDocBase & TrainingStatusFields) | null;
  udoc: BaseUser;
  files: FileInfo[];
};

export type TrainingFilesResponse = Errorable<TrainingFilesData>;

/**
 * Loads the training attachments the current user may manage.
 *
 * @param tid Training identifier.
 */
export const getTrainingFiles = (tid: string) =>
  alova.Get<TrainingFilesResponse>(`/training/${tid}/file`);
