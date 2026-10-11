import type { Collection, IndexDescription } from 'mongodb';
import {
    BACKGROUND_TASK_INDEXES, BACKGROUND_TASK_TIMEOUT_MESSAGE, type BackgroundTaskDoc, BackgroundTaskModel, backgroundTaskModel,
    type BackgroundTaskOwner,
} from '../../../model/backgroundTask';
import type { PlagiarismJob, PlagiarismPayload, PlagiarismReport, PlagiarismScope } from './types';

export const PLAGIARISM_TASK_TYPE = 'contest-plagiarism';
export const PLAGIARISM_TIMEOUT_MS = 300_000;
export const PLAGIARISM_RETENTION_MS = 86_400_000;
export const PLAGIARISM_TIMEOUT_ERROR = 'The plagiarism check exceeded the five-minute time limit. Please try again.';
export const PLAGIARISM_FAILURE_ERROR = 'The plagiarism check failed. Please try again.';

type PlagiarismTaskDoc = BackgroundTaskDoc & {
    contestId: string;
    activeContest?: true;
    payload?: PlagiarismPayload;
    result?: PlagiarismReport;
};

export const PLAGIARISM_TASK_INDEXES: IndexDescription[] = [
    ...BACKGROUND_TASK_INDEXES,
    {
        key: { type: 1, domainId: 1, contestId: 1, activeContest: 1 },
        name: 'activeContest',
        unique: true,
        partialFilterExpression: { activeContest: true },
    },
    { key: { type: 1, domainId: 1, contestId: 1, createdAt: -1 }, name: 'contestLatest' },
];

function taskOwner(scope: PlagiarismScope): BackgroundTaskOwner & PlagiarismScope {
    // Managers share the contest report; actorUid belongs to the payload rather than the access scope.
    return { domainId: scope.domainId, contestId: scope.contestId, pid: 0, uid: 0 };
}

export function toPlagiarismJob(doc: BackgroundTaskDoc): PlagiarismJob {
    const task = doc as PlagiarismTaskDoc;
    return {
        jobId: task.jobId,
        status: task.status,
        createdAt: task.createdAt.toISOString(),
        ...(task.payload?.progress ? { progress: task.payload.progress } : {}),
        ...(task.status === 'completed' ? { result: task.result } : {}),
        ...(task.status === 'failed' ? {
            error: task.error === BACKGROUND_TASK_TIMEOUT_MESSAGE
                ? PLAGIARISM_TIMEOUT_ERROR : task.error || PLAGIARISM_FAILURE_ERROR,
        } : {}),
    };
}

export class ContestPlagiarismStore extends BackgroundTaskModel {
    constructor(collection: Collection<BackgroundTaskDoc> = backgroundTaskModel.coll, capacity = 4) {
        super(collection, capacity, capacity);
    }

    async submit(type: string, owner: BackgroundTaskOwner, payload: PlagiarismPayload, now = new Date()) {
        const id = await super.submit(type, { domainId: owner.domainId, pid: 0, uid: 0 }, payload, now);
        if (!id) return null;
        try {
            await this.coll.updateOne({ jobId: id, type }, {
                $set: { contestId: payload.contestId, activeContest: true, 'payload.jobId': id },
            });
            return id;
        } catch (error) {
            await this.coll.deleteOne({ jobId: id, type, status: 'pending' });
            if ((error as { code?: number }).code === 11000) return null;
            throw error;
        }
    }

    async finish(id: string, type: string, value: { result?: PlagiarismReport, error?: string }, retention: number, now = new Date()) {
        const doc = await this.coll.findOne({ jobId: id, type });
        const failureError = (doc as PlagiarismTaskDoc)?.payload?.failureError;
        const failed = !!value.error;
        const error = value.error !== PLAGIARISM_TIMEOUT_ERROR && failureError ? failureError : value.error;
        // Terminal status and every admission lock are released in one write, including on a crash.
        return this.coll.findOneAndUpdate({ jobId: id, type, status: 'running' }, {
            $set: {
                status: failed ? 'failed' : 'completed',
                ...(failed ? { error } : { result: value.result }),
                finishedAt: now,
                expiresAt: new Date(now.getTime() + retention),
            },
            $unset: {
                activeContest: '', ownerSlot: '', globalSlot: '',
                ...(failed ? { result: '', 'payload.sources': '' } : { error: '' }),
            },
        }, { returnDocument: 'after' });
    }

    async reclaimStalled(type: string, timeoutMs: number, retentionMs: number, now = new Date()) {
        const result = await super.reclaimStalled(type, timeoutMs, retentionMs, now);
        await this.coll.updateMany({ type, status: { $in: ['completed', 'failed'] } }, { $unset: { activeContest: '' } });
        await this.clearFailedSources(type);
        return result;
    }

    async view(id: string, type: string, owner: BackgroundTaskOwner, timeoutMs: number, retentionMs: number) {
        const doc = await super.view(id, type, owner, timeoutMs, retentionMs);
        if (doc?.status === 'failed') await this.clearFailedSources(type, id);
        return doc;
    }

    private clearFailedSources(type: string, jobId?: string) {
        return this.coll.updateMany({ type, status: 'failed', ...(jobId ? { jobId } : {}) }, {
            $unset: { activeContest: '', 'payload.sources': '' },
        });
    }

    owner(scope: PlagiarismScope) { return taskOwner(scope); }

    async latest(scope: PlagiarismScope, activeOnly = false) {
        const doc = await this.coll.findOne({
            type: PLAGIARISM_TASK_TYPE,
            ...taskOwner(scope),
            ...(activeOnly ? { status: { $in: ['pending', 'running'] as BackgroundTaskDoc['status'][] } } : {}),
            $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
        }, { sort: { createdAt: -1, _id: -1 } });
        if (!doc) return null;
        return this.view(doc.jobId, PLAGIARISM_TASK_TYPE, taskOwner(scope), PLAGIARISM_TIMEOUT_MS, PLAGIARISM_RETENTION_MS);
    }

    async updatePayload(id: string, value: Partial<PlagiarismPayload>) {
        const $set = Object.fromEntries(Object.entries(value).map(([key, field]) => [`payload.${key}`, field]));
        return this.coll.updateOne({ jobId: id, type: PLAGIARISM_TASK_TYPE, status: 'running' }, { $set });
    }

    async source(scope: PlagiarismScope, id: string, rid: string) {
        const doc = await this.view(id, PLAGIARISM_TASK_TYPE, taskOwner(scope), PLAGIARISM_TIMEOUT_MS, PLAGIARISM_RETENTION_MS);
        if (doc?.status !== 'completed') return null;
        const source = (doc as PlagiarismTaskDoc).payload?.sources?.find((item) => item.rid === rid);
        if (!source) return null;
        const { uid, pid, code, language } = source;
        return { rid, uid, pid, code, language };
    }
}
