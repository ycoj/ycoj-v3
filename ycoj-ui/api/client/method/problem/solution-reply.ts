import { clientRequest } from '@/api/client';
import type { Errorable } from '@/shared/types/error';
import type { ObjectId } from '@/shared/types/shared';

/** Backend `Handler#back()` echoes the referer as `url` for mutations. */
export type ProblemSolutionReplyMutationResponse = {
  url?: string;
};

export type ProblemSolutionReplyResponse = ProblemSolutionReplyMutationResponse;

export type ProblemSolutionReplyInput = {
  psid: ObjectId;
  content: string;
};

export const replyProblemSolution = (
  pid: number | string,
  psid: ObjectId,
  content: string
) =>
  clientRequest.Post<Errorable<ProblemSolutionReplyResponse>>(
    `/p/${pid}/solution`,
    {
      operation: 'reply',
      psid,
      content,
    }
  );

export const editProblemSolutionReply = (
  pid: number | string,
  psid: ObjectId,
  psrid: ObjectId,
  content: string
) =>
  clientRequest.Post<Errorable<ProblemSolutionReplyMutationResponse>>(
    `/p/${pid}/solution`,
    {
      operation: 'edit_reply',
      psid,
      psrid,
      content,
    }
  );

export const deleteProblemSolutionReply = (
  pid: number | string,
  psid: ObjectId,
  psrid: ObjectId
) =>
  clientRequest.Post<Errorable<ProblemSolutionReplyMutationResponse>>(
    `/p/${pid}/solution`,
    {
      operation: 'delete_reply',
      psid,
      psrid,
    }
  );
