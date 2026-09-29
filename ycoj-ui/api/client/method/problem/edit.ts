import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';

export type EditProblemRequest = {
  pid?: string;
  title: string;
  content: string;
  tag?: string;
  difficulty?: number;
  hidden?: boolean;
};

export type EditProblemResponse = {
  url?: string;
};

export type DeleteProblemResponse = {
  url?: string;
};

export const editProblem = (pid: string, payload: EditProblemRequest) =>
  clientRequest.Post<EditProblemResponse>(`/p/${pid}/edit`, payload);

export const deleteProblem = (pid: string) =>
  clientRequest.Post<Errorable<DeleteProblemResponse>>(`/p/${pid}`, {
    operation: 'delete',
  });
