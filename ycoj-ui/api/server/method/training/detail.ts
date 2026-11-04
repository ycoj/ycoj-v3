import { alova } from '@/api/server';
import type { GDoc } from '@/shared/types/contest';
import type {
  ListProjectionProblem,
  ProblemStatus as ProblemStatusDoc,
} from '@/shared/types/problem';
import type {
  StatusDocBase,
  TrainingDoc,
  TrainingNode,
  TrainingNodeStatus,
  TrainingStatusFields,
} from '@/shared/types/training';
import type { BaseUserDict, User } from '@/shared/types/user';

/** Problem columns shown on the training detail page. Statements and testdata are not included. */
export type TrainingDetailProblem = ListProjectionProblem & {
  maintainer?: number[];
};

export type TrainingDetailResponse = {
  tdoc: TrainingDoc;
  tsdoc: StatusDocBase & TrainingStatusFields;
  pids: number[];
  pdict: Record<number, TrainingDetailProblem>;
  psdict: Record<number, ProblemStatusDoc>;
  ndict: Record<number, TrainingNode>;
  nsdict: Record<number, TrainingNodeStatus>;
  udoc: User;
  udict: BaseUserDict;
  selfPsdict: Record<number, ProblemStatusDoc>;
  groups: GDoc[];
  missing: number[];
};

export const getTrainingDetail = (tid: string, uid?: number) =>
  alova.Get<TrainingDetailResponse>(`/training/${tid}`, {
    params: {
      // The page does not render the enrollee directory or domain groups.
      brief: true,
      ...(uid !== undefined ? { uid } : {}),
    },
  });
