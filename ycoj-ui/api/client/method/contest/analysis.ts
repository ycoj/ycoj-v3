import { clientRequest } from '@/api/client';
import type {
  ContestAnalysisJob,
  ContestAnalysisLanguage,
  ContestAnalysisOverview,
} from '@/shared/types/contest-analysis';
import type { Errorable } from '@/shared/types/error';

export type CreateContestAnalysisRequest = {
  tids: string[];
  title?: string;
  instructions?: string;
  includeStudents?: boolean;
  profileId?: string;
  language?: ContestAnalysisLanguage;
};

export type ContestAnalysisJobResponse = Errorable<{ job: ContestAnalysisJob }>;

export const getContestAnalysisOverview = () =>
  clientRequest.Get<Errorable<ContestAnalysisOverview>>('/contest/analysis', {
    cacheFor: 0,
  });

export const createContestAnalysis = (request: CreateContestAnalysisRequest) =>
  clientRequest.Post<Errorable<{ jobId: string }>>(
    '/contest/analysis',
    request
  );

export const getContestAnalysisJob = (aid: string) =>
  clientRequest.Get<ContestAnalysisJobResponse>(`/contest/analysis/${aid}`, {
    cacheFor: 0,
  });

export const cancelContestAnalysis = (aid: string) =>
  clientRequest.Post<Errorable<{ ok: boolean }>>(`/contest/analysis/${aid}`, {
    operation: 'cancel',
  });

export const deleteContestAnalysis = (aid: string) =>
  clientRequest.Post<Errorable<{ ok: boolean }>>(`/contest/analysis/${aid}`, {
    operation: 'delete',
  });

export const retryContestAnalysis = (aid: string) =>
  clientRequest.Post<Errorable<{ jobId: string }>>(`/contest/analysis/${aid}`, {
    operation: 'retry',
  });
