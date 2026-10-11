import { BackgroundTaskService } from '../background/runner';
import { ENGINE_VERSION } from '../plagiarism';
import { runPlagiarismComparisons } from '../plagiarismExecutor';
import { loadPlagiarismSnapshot, PlagiarismInputError } from './snapshot';
import {
    ContestPlagiarismStore, PLAGIARISM_FAILURE_ERROR, PLAGIARISM_RETENTION_MS, PLAGIARISM_TASK_TYPE,
    PLAGIARISM_TIMEOUT_ERROR, PLAGIARISM_TIMEOUT_MS, toPlagiarismJob,
} from './store';
import type {
    PlagiarismJob, PlagiarismParticipant, PlagiarismPayload, PlagiarismReport, PlagiarismRequest, PlagiarismScope,
} from './types';

interface JobsOptions {
    store?: ContestPlagiarismStore;
    loadSnapshot?: typeof loadPlagiarismSnapshot;
    compare?: typeof runPlagiarismComparisons;
    timeoutMs?: number;
}

export class ContestPlagiarismJobs {
    readonly store: ContestPlagiarismStore;
    private service: BackgroundTaskService;

    constructor(options: JobsOptions = {}) {
        this.store = options.store ?? new ContestPlagiarismStore();
        const loadSnapshot = options.loadSnapshot ?? loadPlagiarismSnapshot;
        const compare = options.compare ?? runPlagiarismComparisons;
        this.service = new BackgroundTaskService(this.store).register({
            type: PLAGIARISM_TASK_TYPE,
            timeoutMs: options.timeoutMs ?? PLAGIARISM_TIMEOUT_MS,
            retentionMs: PLAGIARISM_RETENTION_MS,
            timeoutError: PLAGIARISM_TIMEOUT_ERROR,
            failureError: PLAGIARISM_FAILURE_ERROR,
            toPublic: toPlagiarismJob,
            run: async (payload: PlagiarismPayload, signal: AbortSignal): Promise<PlagiarismReport> => {
                const startedAt = Date.now();
                const jobId = payload.jobId;
                if (!jobId) throw new Error('Missing persistent job ID.');
                try {
                    const snapshot = await loadSnapshot(payload, signal);
                    if (signal.aborted) throw new Error('aborted');
                    await this.store.updatePayload(jobId, { sources: snapshot.sources });
                    const comparison = await compare(snapshot.sources, signal, async (progress) => {
                        await this.store.updatePayload(jobId, { progress });
                    });
                    if (signal.aborted) throw new Error('aborted');
                    const prepared = new Map(comparison.prepared.map((item) => [item.rid, item]));
                    const byId = new Map(snapshot.sources.map((item) => [item.rid, item]));
                    const accepted = snapshot.sources.filter((item) => prepared.has(item.rid));
                    const participant = (rid: string): PlagiarismParticipant => {
                        const source = byId.get(rid);
                        const analyzed = prepared.get(rid);
                        if (!source || !analyzed) throw new Error('Comparison returned an unknown submission.');
                        return {
                            rid, uid: source.uid, language: source.language,
                            submittedAt: source.submittedAt, tokenCount: analyzed.tokenCount,
                        };
                    };
                    const pairs = comparison.pairs.map((pair) => ({
                        pid: pair.pid,
                        left: participant(pair.leftRid),
                        right: participant(pair.rightRid),
                        similarity: pair.similarity,
                        scores: pair.scores,
                        matches: pair.matches.slice(0, 16),
                        warnings: [...new Set([
                            ...pair.warnings,
                            ...(prepared.get(pair.leftRid)?.warnings || []),
                            ...(prepared.get(pair.rightRid)?.warnings || []),
                            ...(pair.matches.length > 16 ? ['evidence-regions-limited'] : []),
                        ])],
                    })).sort((left, right) => right.similarity - left.similarity || left.pid - right.pid);
                    const report: PlagiarismReport = {
                        version: ENGINE_VERSION,
                        generatedAt: new Date().toISOString(),
                        elapsedMs: Date.now() - startedAt,
                        participantCount: snapshot.participantCount,
                        submissionCount: accepted.length,
                        comparedPairs: pairs.length,
                        skippedSubmissions: [
                            ...snapshot.skippedSubmissions,
                            ...comparison.skipped.map((item) => {
                                const source = byId.get(item.rid);
                                if (!source) throw new Error('Comparison skipped an unknown submission.');
                                return { rid: item.rid, uid: source.uid, pid: source.pid, reason: item.reason };
                            }),
                        ],
                        users: snapshot.users,
                        problems: snapshot.problems.map((item) => ({
                            ...item,
                            submissionCount: accepted.filter((source) => source.pid === item.pid).length,
                            participantCount: new Set(accepted.filter((source) => source.pid === item.pid).map((source) => source.uid)).size,
                            comparedPairs: pairs.filter((pair) => pair.pid === item.pid).length,
                        })),
                        pairs,
                    };
                    // At most 80 × 64 KiB sources plus a bounded 760-pair report fit well below BSON's 16 MiB limit.
                    if (Buffer.byteLength(JSON.stringify(report), 'utf8') > 4_000_000) {
                        throw new PlagiarismInputError('The similarity report exceeded the storage limit.');
                    }
                    await this.store.updatePayload(jobId, {
                        sources: accepted,
                        progress: { completedPairs: pairs.length, totalPairs: pairs.length },
                    });
                    return report;
                } catch (error) {
                    if (error instanceof PlagiarismInputError) {
                        await this.store.updatePayload(jobId, { failureError: error.message });
                    }
                    throw error;
                }
            },
        });
    }

    async submit(request: PlagiarismRequest): Promise<PlagiarismJob | null> {
        await this.service.sweep();
        const existing = await this.store.latest(request, true);
        if (existing && (existing.status === 'pending' || existing.status === 'running')) return toPlagiarismJob(existing);
        const admitted = await this.service.submit(PLAGIARISM_TASK_TYPE, this.store.owner(request), request);
        if (!admitted) {
            const competing = await this.store.latest(request, true);
            return competing ? toPlagiarismJob(competing) : null;
        }
        const doc = await this.store.get(admitted.jobId, PLAGIARISM_TASK_TYPE, this.store.owner(request));
        return doc ? { jobId: admitted.jobId, status: 'pending', createdAt: doc.createdAt.toISOString() } : null;
    }

    async latest(scope: PlagiarismScope): Promise<PlagiarismJob | null> {
        const doc = await this.store.latest(scope);
        return doc ? toPlagiarismJob(doc) : null;
    }

    get(id: string, scope: PlagiarismScope): Promise<PlagiarismJob | null> {
        return this.service.get(PLAGIARISM_TASK_TYPE, id, this.store.owner(scope));
    }

    source(id: string, scope: PlagiarismScope, rid: string) { return this.store.source(scope, id, rid); }
    sweep() { return this.service.sweep(); }
    drain() { return this.service.drain(); }
    dispose() { this.service.dispose(); }
}
