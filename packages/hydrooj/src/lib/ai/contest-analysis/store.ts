import type { Collection, IndexDescription } from 'mongodb';
import {
    BACKGROUND_TASK_INDEXES, BACKGROUND_TASK_TIMEOUT_MESSAGE, type BackgroundTaskDoc,
    BackgroundTaskModel, backgroundTaskModel, type BackgroundTaskOwner,
} from '../../../model/backgroundTask';
import type {
    ContestAnalysisJob, ContestAnalysisJobStatus, ContestAnalysisJobSummary,
    ContestAnalysisPayload, ContestAnalysisResult,
} from './types';

export const CONTEST_ANALYSIS_TASK_TYPE = 'contest-analysis';
export const CONTEST_ANALYSIS_TIMEOUT_MS = 60 * 60 * 1000;
export const CONTEST_ANALYSIS_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const CONTEST_ANALYSIS_TIMEOUT_ERROR = 'The analysis exceeded the one-hour limit. '
    + 'Reduce the number of contests or participants and try again.';
export const CONTEST_ANALYSIS_FAILURE_ERROR = 'The contest analysis failed. Please try again.';
export const CONTEST_ANALYSIS_CANCELLED_ERROR = 'The contest analysis was cancelled.';
export const CONTEST_ANALYSIS_STARTED_ERROR = 'Two contest analysis jobs are already running. Wait for one of them to finish and try again.';

export type ContestAnalysisTaskDoc = BackgroundTaskDoc & {
    activeAnalysis?: true;
    payload?: ContestAnalysisPayload;
    result?: ContestAnalysisResult;
};

export const CONTEST_ANALYSIS_INDEXES: IndexDescription[] = [
    ...BACKGROUND_TASK_INDEXES,
    {
        key: { type: 1, domainId: 1, pid: 1, uid: 1, activeAnalysis: 1 },
        name: 'analysisOwner',
        unique: true,
        partialFilterExpression: { activeAnalysis: true },
    },
    { key: { type: 1, domainId: 1, createdAt: -1 }, name: 'analysisLatest' },
];

export function contestAnalysisOwner(domainId: string): BackgroundTaskOwner {
    // Every contest manager of a domain shares the same analysis list.
    return { domainId, pid: 0, uid: 0 };
}

function publicStatus(doc: ContestAnalysisTaskDoc): ContestAnalysisJobStatus {
    if (doc.status === 'failed' && doc.payload?.cancelRequested) return 'cancelled';
    return doc.status;
}

function publicError(doc: ContestAnalysisTaskDoc) {
    if (doc.payload?.cancelRequested) return CONTEST_ANALYSIS_CANCELLED_ERROR;
    if (doc.error === BACKGROUND_TASK_TIMEOUT_MESSAGE) return CONTEST_ANALYSIS_TIMEOUT_ERROR;
    return doc.error || (doc.status === 'failed' ? CONTEST_ANALYSIS_FAILURE_ERROR : undefined);
}

function publicStage(doc: ContestAnalysisTaskDoc) {
    if (doc.payload?.cancelRequested) return 'cancelled' as const;
    if (doc.status === 'failed' && doc.error === CONTEST_ANALYSIS_TIMEOUT_ERROR) return 'timed_out' as const;
    if (doc.status === 'failed' && !doc.payload?.stage) return 'failed' as const;
    return doc.payload?.stage || (doc.status === 'pending' ? 'waiting' as const : 'failed' as const);
}

export function toContestAnalysisJob(doc: BackgroundTaskDoc): ContestAnalysisJob {
    const task = doc as ContestAnalysisTaskDoc;
    const payload = task.payload;
    const status = publicStatus(task);
    return {
        jobId: task.jobId,
        status,
        stage: publicStage(task),
        progress: Math.max(0, Math.min(100, payload?.progress || 0)),
        createdAt: task.createdAt.toISOString(),
        ...(task.finishedAt ? { finishedAt: task.finishedAt.toISOString() } : {}),
        ...(payload?.model ? { model: payload.model } : {}),
        ...(payload?.scope ? { scope: payload.scope } : {}),
        events: payload?.events || [],
        ...(task.status === 'completed' && task.result ? { result: task.result } : {}),
        ...(status === 'failed' || status === 'cancelled' ? { error: publicError(task) } : {}),
    };
}

export function toContestAnalysisSummary(doc: BackgroundTaskDoc): ContestAnalysisJobSummary {
    const task = doc as ContestAnalysisTaskDoc;
    const payload = task.payload;
    return {
        jobId: task.jobId,
        status: publicStatus(task),
        stage: publicStage(task),
        progress: Math.max(0, Math.min(100, payload?.progress || 0)),
        createdAt: task.createdAt.toISOString(),
        ...(task.finishedAt ? { finishedAt: task.finishedAt.toISOString() } : {}),
        ...(payload?.model ? { model: payload.model } : {}),
        title: payload?.title || payload?.scope?.title || 'Contest analysis',
        contestCount: payload?.tids?.length || payload?.scope?.contests.length || 0,
        studentCount: payload?.studentTotal || payload?.scope?.studentCount || 0,
        ...(publicStatus(task) === 'failed' || publicStatus(task) === 'cancelled'
            ? { error: publicError(task) } : {}),
    };
}

export class ContestAnalysisStore extends BackgroundTaskModel {
    constructor(collection: Collection<BackgroundTaskDoc> = backgroundTaskModel.coll, capacity = 2, ownerCapacity = 2) {
        super(collection, capacity, ownerCapacity);
    }

    async submit(
        type: string,
        owner: BackgroundTaskOwner,
        payload?: ContestAnalysisPayload,
        now = new Date(),
    ) {
        if (!payload) throw new Error('Contest analysis payload is required.');
        const jobId = await super.submit(type, owner, payload, now);
        if (!jobId) return null;
        try {
            await this.coll.updateOne({ jobId, type }, {
                $set: { activeAnalysis: true, 'payload.jobId': jobId },
            });
            return jobId;
        } catch (error) {
            await this.coll.deleteOne({ jobId, type, status: 'pending' });
            if ((error as { code?: number }).code === 11000) return null;
            throw error;
        }
    }

    async finish(
        id: string, type: string, value: { result?: any, error?: string },
        retention: number, now = new Date(),
    ) {
        const doc = await this.coll.findOne({ jobId: id, type }) as ContestAnalysisTaskDoc | null;
        const cancelled = !!doc?.payload?.cancelRequested;
        const failed = !!value.error || cancelled;
        return this.coll.findOneAndUpdate({ jobId: id, type, status: 'running' }, {
            $set: {
                status: failed ? 'failed' : 'completed',
                ...(failed ? { error: cancelled ? CONTEST_ANALYSIS_CANCELLED_ERROR : value.error } : { result: value.result }),
                finishedAt: now,
                expiresAt: new Date(now.getTime() + retention),
                ...(doc?.payload ? { 'payload.stage': cancelled ? 'cancelled' : failed ? 'failed' : 'done' } : {}),
            },
            $unset: {
                activeAnalysis: '', ownerSlot: '', globalSlot: '',
                ...(failed ? { result: '' } : { error: '' }),
            },
        }, { returnDocument: 'after' });
    }

    async reclaimStalled(type: string, timeoutMs: number, retentionMs: number, now = new Date()) {
        const result = await super.reclaimStalled(type, timeoutMs, retentionMs, now);
        await this.coll.updateMany({ type, status: { $in: ['completed', 'failed'] } }, { $unset: { activeAnalysis: '' } });
        return result;
    }

    async updatePayload(id: string, value: Partial<ContestAnalysisPayload>) {
        const $set = Object.fromEntries(Object.entries(value).map(([key, field]) => [`payload.${key}`, field]));
        if (!Object.keys($set).length) return;
        await this.coll.updateOne({ jobId: id, type: CONTEST_ANALYSIS_TASK_TYPE, status: 'running' }, { $set });
    }

    async requestCancel(id: string) {
        return this.coll.findOneAndUpdate(
            { jobId: id, type: CONTEST_ANALYSIS_TASK_TYPE, status: { $in: ['pending', 'running'] } },
            { $set: { 'payload.cancelRequested': true } },
            { returnDocument: 'after' },
        );
    }

    async viewJob(domainId: string, id: string) {
        const doc = await super.view(
            id, CONTEST_ANALYSIS_TASK_TYPE, contestAnalysisOwner(domainId),
            CONTEST_ANALYSIS_TIMEOUT_MS, CONTEST_ANALYSIS_RETENTION_MS,
        );
        return doc as ContestAnalysisTaskDoc | null;
    }

    async latest(scope: { domainId: string }, activeOnly = false) {
        const doc = await this.coll.findOne({
            type: CONTEST_ANALYSIS_TASK_TYPE,
            ...contestAnalysisOwner(scope.domainId),
            ...(activeOnly ? { status: { $in: ['pending', 'running'] as BackgroundTaskDoc['status'][] } } : {}),
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
        }, { sort: { createdAt: -1, _id: -1 } });
        return doc as ContestAnalysisTaskDoc | null;
    }

    async findJob(domainId: string, jobId: string) {
        return this.viewJob(domainId, jobId);
    }

    async removeJob(domainId: string, jobId: string) {
        return this.coll.deleteOne({
            jobId,
            type: CONTEST_ANALYSIS_TASK_TYPE,
            ...contestAnalysisOwner(domainId),
        });
    }

    async list(domainId: string, limit = 30) {
        const docs = await this.coll.find({
            type: CONTEST_ANALYSIS_TASK_TYPE,
            ...contestAnalysisOwner(domainId),
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
        }, { sort: { createdAt: -1, _id: -1 }, limit }).toArray();
        return docs as ContestAnalysisTaskDoc[];
    }
}
