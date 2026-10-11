import { clientRequest } from '@/api/client';
import type {
  ContestPlagiarismResponse,
  PlagiarismJob,
  PlagiarismSource,
} from '@/shared/types/contest-plagiarism';
import type { Errorable } from '@/shared/types/error';

export const getContestPlagiarism = (tid: string) =>
  clientRequest.Get<Errorable<ContestPlagiarismResponse>>(
    `/contest/${tid}/plagiarism`,
    { cacheFor: 0 }
  );

export const startContestPlagiarism = (tid: string) =>
  clientRequest.Post<Errorable<PlagiarismJob>>(
    `/contest/${tid}/plagiarism`,
    {}
  );

export const getContestPlagiarismJob = (tid: string, jobId: string) =>
  clientRequest.Get<Errorable<PlagiarismJob>>(
    `/contest/${tid}/plagiarism/${jobId}`,
    { cacheFor: 0 }
  );

export const getContestPlagiarismSource = (
  tid: string,
  jobId: string,
  rid: string
) =>
  clientRequest.Get<Errorable<PlagiarismSource>>(
    `/contest/${tid}/plagiarism/${jobId}/source/${rid}`,
    { cacheFor: 0 }
  );
