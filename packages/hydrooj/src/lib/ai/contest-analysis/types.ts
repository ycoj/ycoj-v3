export const CONTEST_ANALYSIS_SCHEMA = 'hydro.contest-analysis';
export const CONTEST_ANALYSIS_VERSION = 1 as const;

export const MAX_ANALYSIS_CONTESTS = 12;
export const MAX_ANALYSIS_STUDENTS = 200;
export const MAX_ANALYSIS_EVENTS = 600;
export const STUDENT_BATCH_SIZE = 6;

export type ContestAnalysisJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type ContestAnalysisStage =
    | 'waiting' | 'preparing' | 'overview' | 'students' | 'finalizing'
    | 'done' | 'failed' | 'cancelled' | 'timed_out';

export type ContestAnalysisLanguage = 'zh' | 'en';

export interface ContestAnalysisRequest {
    tids: string[];
    title?: string;
    instructions?: string;
    includeStudents: boolean;
    actorUid: number;
    language?: ContestAnalysisLanguage;
}

export interface ContestAnalysisPayload extends ContestAnalysisRequest {
    jobId?: string;
    domain: string;
    profileId?: string;
    stage: ContestAnalysisStage;
    progress: number;
    events: ContestAnalysisEvent[];
    scope: ContestAnalysisScopeSummary;
    model?: string;
    studentTotal?: number;
    studentDone?: number;
    cancelRequested?: boolean;
}

export interface ContestAnalysisEvent {
    seq: number;
    type: 'stage' | 'tool' | 'agent' | 'info';
    state: 'running' | 'succeeded' | 'failed';
    /** English fallback shown when a client does not know `code`. */
    label: string;
    /** Machine-readable key that clients can translate (for example `prepare`, `student_batch`). */
    code?: string;
    params?: Record<string, string | number>;
    detail?: string;
    tool?: string;
    startedAt: string;
    finishedAt?: string;
}

export interface ContestAnalysisProblemFact {
    pid: number;
    title: string;
    /** Raw problem statement; absent in snapshots created before statement access was added. */
    content?: string;
    difficulty: number;
    tags: string[];
    maxScore: number;
    submissionCount: number;
    attemptCount: number;
    acceptCount: number;
    averageScore: number;
    scoreBuckets: number[];
}

export interface ContestAnalysisContestFact {
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
    tagOverlap: { tag: string, pids: number[] }[];
    scoreStats: {
        count: number;
        mean: number;
        median: number;
        max: number;
        min: number;
        buckets: number[];
    };
}

export interface ContestAnalysisProblemResult {
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
}

export interface ContestAnalysisStudentContestResult {
    tid: string;
    title: string;
    score: number;
    maxScore: number;
    rank: number;
    participantCount: number;
    solved: number[];
    problems: ContestAnalysisProblemResult[];
}

export interface ContestAnalysisTagStat {
    tag: string;
    problemCount: number;
    contestCount: number;
    attemptCount: number;
    studentCount: number;
    solveCount: number;
    solveRate: number;
    scoreRate: number;
    problems: { tid: string, pid: number, title: string, difficulty: number, solveRate: number }[];
}

export interface ContestAnalysisStudentFact {
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
}

export interface ContestAnalysisSnapshot {
    version: typeof CONTEST_ANALYSIS_VERSION;
    generatedAt: string;
    title: string;
    instructions: string;
    contests: ContestAnalysisContestFact[];
    tags: ContestAnalysisTagStat[];
    students: ContestAnalysisStudentFact[];
}

export interface ContestAnalysisWeakPoint {
    tag: string;
    severity: 'high' | 'medium' | 'low';
    summary: string;
    evidence: string;
    contests: string[];
    advice: string;
}

export interface ContestAnalysisOverviewReport {
    summary: string;
    keywords: string[];
    weakPoints: ContestAnalysisWeakPoint[];
    difficultyComment: string;
    balanceComment: string;
    highlights: string[];
    recommendations: string[];
}

export interface ContestAnalysisContestReport {
    tid: string;
    summary: string;
    difficultyComment: string;
    balanceComment: string;
    problemComments: { pid: number, comment: string }[];
}

export interface ContestAnalysisStudentReport {
    uid: number;
    level: 'excellent' | 'good' | 'average' | 'weak' | 'at_risk';
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recurringIssues: { issue: string, evidence: string, advice: string }[];
    focusTags: string[];
    contestComments: { tid: string, comment: string }[];
    actionPlan: string[];
}

export interface ContestAnalysisReport {
    version: typeof CONTEST_ANALYSIS_VERSION;
    overview: ContestAnalysisOverviewReport;
    contests: ContestAnalysisContestReport[];
    students: ContestAnalysisStudentReport[];
}

export interface ContestAnalysisResult {
    snapshot: ContestAnalysisSnapshot;
    report: ContestAnalysisReport;
}

export interface ContestAnalysisScopeSummary {
    title: string;
    contests: { tid: string, title: string, beginAt: string, problemCount: number, participantCount: number }[];
    problemCount: number;
    studentCount: number;
}

export interface ContestAnalysisJob {
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
}

export interface ContestAnalysisJobSummary {
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
}
