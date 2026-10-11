import type { Contest } from '@/shared/types/contest';

export type PlagiarismMethod = 'heuristic' | 'tree-sitter';

export type PlagiarismSubmission = {
  rid: string;
  uid: number;
  language: string;
  submittedAt: string;
  tokenCount: number;
};

export type PlagiarismMatch = {
  leftStartLine: number;
  leftEndLine: number;
  rightStartLine: number;
  rightEndLine: number;
  tokenCount: number;
};

export type PlagiarismPair = {
  pid: number;
  left: PlagiarismSubmission;
  right: PlagiarismSubmission;
  similarity: number;
  scores: { token: number; structure: number; fingerprint: number };
  matches: PlagiarismMatch[];
  warnings: string[];
};

export type PlagiarismReport = {
  method?: PlagiarismMethod;
  version: string;
  generatedAt: string;
  elapsedMs: number;
  participantCount: number;
  submissionCount: number;
  comparedPairs: number;
  users: Record<number, { _id: number; uname: string; displayName?: string }>;
  skippedSubmissions: Array<{
    rid: string;
    uid: number;
    pid: number;
    reason: string;
  }>;
  problems: Array<{
    pid: number;
    title: string;
    submissionCount: number;
    participantCount: number;
    comparedPairs: number;
  }>;
  pairs: PlagiarismPair[];
};

export type PlagiarismJob = {
  method?: PlagiarismMethod;
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  progress?: { completedPairs: number; totalPairs: number };
  result?: PlagiarismReport;
  error?: string;
};

export type ContestPlagiarismResponse = {
  tdoc: Contest;
  job: PlagiarismJob | null;
};

export type PlagiarismSource = {
  rid: string;
  uid: number;
  pid: number;
  code: string;
  language: string;
};
