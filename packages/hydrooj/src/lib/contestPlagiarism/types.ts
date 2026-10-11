import type { BackgroundTaskStatus } from '../../model/backgroundTask';

export interface PlagiarismSubmission {
    rid: string;
    uid: number;
    pid: number;
    language: string;
    submittedAt: string;
    code: string;
}

export interface PlagiarismParticipant {
    rid: string;
    uid: number;
    language: string;
    submittedAt: string;
    tokenCount: number;
}

export interface PlagiarismMatch {
    leftStartLine: number;
    leftEndLine: number;
    rightStartLine: number;
    rightEndLine: number;
    tokenCount: number;
}

export interface PlagiarismPair {
    pid: number;
    left: PlagiarismParticipant;
    right: PlagiarismParticipant;
    similarity: number;
    scores: { token: number, structure: number, fingerprint: number };
    matches: PlagiarismMatch[];
    warnings: string[];
}

export interface PlagiarismSkippedSubmission { rid: string, uid: number, pid: number, reason: string }
export interface PlagiarismProgress { completedPairs: number, totalPairs: number }
export interface PlagiarismUser { _id: number, uname: string, displayName?: string }
export interface PlagiarismProblem {
    pid: number;
    title: string;
    submissionCount: number;
    participantCount: number;
    comparedPairs: number;
}

export interface PlagiarismReport {
    version: string;
    generatedAt: string;
    elapsedMs: number;
    participantCount: number;
    submissionCount: number;
    comparedPairs: number;
    skippedSubmissions: PlagiarismSkippedSubmission[];
    problems: PlagiarismProblem[];
    pairs: PlagiarismPair[];
    users: Record<number, PlagiarismUser>;
}

export interface PlagiarismJob {
    jobId: string;
    status: BackgroundTaskStatus;
    createdAt: string;
    progress?: PlagiarismProgress;
    result?: PlagiarismReport;
    error?: string;
}

export interface PlagiarismScope { domainId: string, contestId: string }
export type PlagiarismRequest = PlagiarismScope & {
    actorUid: number;
    beginAt: string;
    endAt: string;
    pids: number[];
};
export type PlagiarismPayload = PlagiarismRequest & {
    jobId?: string;
    progress?: PlagiarismProgress;
    sources?: PlagiarismSubmission[];
    failureError?: string;
};
export interface PlagiarismSnapshot {
    sources: PlagiarismSubmission[];
    skippedSubmissions: PlagiarismSkippedSubmission[];
    users: Record<number, PlagiarismUser>;
    participantCount: number;
    problems: Array<{ pid: number, title: string }>;
}
