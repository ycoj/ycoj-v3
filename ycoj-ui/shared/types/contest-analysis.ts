export type ContestAnalysisJobStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ContestAnalysisStage =
  | 'waiting'
  | 'preparing'
  | 'overview'
  | 'students'
  | 'finalizing'
  | 'done'
  | 'failed'
  | 'cancelled'
  | 'timed_out';

export type ContestAnalysisLanguage = 'zh' | 'en';

export type ContestAnalysisEvent = {
  seq: number;
  type: 'stage' | 'tool' | 'agent' | 'info';
  state: 'running' | 'succeeded' | 'failed';
  /** English fallback used when `code` has no translation. */
  label: string;
  code?: string;
  params?: Record<string, string | number>;
  detail?: string;
  tool?: string;
  startedAt: string;
  finishedAt?: string;
};

export type ContestAnalysisProblemFact = {
  pid: number;
  title: string;
  difficulty: number;
  tags: string[];
  maxScore: number;
  submissionCount: number;
  attemptCount: number;
  acceptCount: number;
  averageScore: number;
  scoreBuckets: number[];
};

export type ContestAnalysisContestFact = {
  tid: string;
  title: string;
  rule: string;
  beginAt: string;
  endAt: string;
  durationMs: number;
  registeredCount: number;
  participantCount: number;
  problems: ContestAnalysisProblemFact[];
  difficultyGradient: number[];
  tagOverlap: { tag: string; pids: number[] }[];
  scoreStats: {
    count: number;
    mean: number;
    median: number;
    max: number;
    min: number;
    buckets: number[];
  };
};

export type ContestAnalysisProblemResult = {
  pid: number;
  title: string;
  difficulty: number;
  tags: string[];
  score: number;
  maxScore: number;
  accepted: boolean;
  attempts: number;
  wrongAttempts: number;
  firstScore?: number;
};

export type ContestAnalysisStudentContestResult = {
  tid: string;
  title: string;
  score: number;
  maxScore: number;
  rank: number;
  participantCount: number;
  solved: number[];
  problems: ContestAnalysisProblemResult[];
};

export type ContestAnalysisTagStat = {
  tag: string;
  problemCount: number;
  contestCount: number;
  attemptCount: number;
  studentCount: number;
  solveCount: number;
  solveRate: number;
  scoreRate: number;
  problems: {
    tid: string;
    pid: number;
    title: string;
    difficulty: number;
    solveRate: number;
  }[];
};

export type ContestAnalysisStudentFact = {
  uid: number;
  uname: string;
  displayName: string;
  realName?: string;
  contests: ContestAnalysisStudentContestResult[];
  totals: {
    score: number;
    maxScore: number;
    contestCount: number;
    attendedCount: number;
    solvedCount: number;
    problemCount: number;
    averageScore: number;
    medianRank: number;
  };
  tags: {
    tag: string;
    attempted: number;
    solved: number;
    partial: number;
    failed: number;
  }[];
};

export type ContestAnalysisSnapshot = {
  version: 1;
  generatedAt: string;
  title: string;
  instructions: string;
  contests: ContestAnalysisContestFact[];
  tags: ContestAnalysisTagStat[];
  students: ContestAnalysisStudentFact[];
};

export type ContestAnalysisWeakPoint = {
  tag: string;
  severity: 'high' | 'medium' | 'low';
  summary: string;
  evidence: string;
  contests: string[];
  advice: string;
};

export type ContestAnalysisOverviewReport = {
  summary: string;
  keywords: string[];
  weakPoints: ContestAnalysisWeakPoint[];
  difficultyComment: string;
  balanceComment: string;
  highlights: string[];
  recommendations: string[];
};

export type ContestAnalysisContestReport = {
  tid: string;
  summary: string;
  difficultyComment: string;
  balanceComment: string;
  problemComments: { pid: number; comment: string }[];
};

export type ContestAnalysisStudentReport = {
  uid: number;
  level: 'excellent' | 'good' | 'average' | 'weak' | 'at_risk';
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recurringIssues: { issue: string; evidence: string; advice: string }[];
  focusTags: string[];
  contestComments: { tid: string; comment: string }[];
  actionPlan: string[];
};

export type ContestAnalysisReport = {
  version: 1;
  overview: ContestAnalysisOverviewReport;
  contests: ContestAnalysisContestReport[];
  students: ContestAnalysisStudentReport[];
};

export type ContestAnalysisResult = {
  snapshot: ContestAnalysisSnapshot;
  report: ContestAnalysisReport;
};

export type ContestAnalysisScopeSummary = {
  title: string;
  contests: {
    tid: string;
    title: string;
    beginAt: string;
    problemCount: number;
    participantCount: number;
  }[];
  problemCount: number;
  studentCount: number;
};

export type ContestAnalysisJob = {
  jobId: string;
  status: ContestAnalysisJobStatus;
  stage: ContestAnalysisStage;
  progress: number;
  createdAt: string;
  finishedAt?: string;
  model?: string;
  scope?: ContestAnalysisScopeSummary;
  events: ContestAnalysisEvent[];
  result?: ContestAnalysisResult;
  error?: string;
};

export type ContestAnalysisJobSummary = {
  jobId: string;
  status: ContestAnalysisJobStatus;
  stage: ContestAnalysisStage;
  progress: number;
  createdAt: string;
  finishedAt?: string;
  model?: string;
  title: string;
  contestCount: number;
  studentCount: number;
  error?: string;
};

export type ContestAnalysisProfile = {
  id: string;
  label: string;
  model: string;
};

export type ContestAnalysisOverview = {
  enabled: boolean;
  profiles: ContestAnalysisProfile[];
  defaultProfileId: string;
  jobs: ContestAnalysisJobSummary[];
};
