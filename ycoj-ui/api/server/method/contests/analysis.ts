import { alova } from '@/api/server';
import type {
  ContestAnalysisJob,
  ContestAnalysisOverview,
} from '@/shared/types/contest-analysis';
import type { Errorable } from '@/shared/types/error';

export type ContestAnalysisOverviewResponse =
  Errorable<ContestAnalysisOverview>;

export type ContestAnalysisJobResponse = Errorable<{
  job: ContestAnalysisJob;
  canManage: boolean;
}>;

export const getContestAnalysisOverview = () =>
  alova.Get<ContestAnalysisOverviewResponse>('/contest/analysis');

export const getContestAnalysisJob = (aid: string) =>
  alova.Get<ContestAnalysisJobResponse>(`/contest/analysis/${aid}`);
