import { ObjectId } from 'mongodb';
import { BackgroundTaskService } from '../../background/runner';
import { type AiAgentRunner, createToolAgent, type CreateToolAgentOptions } from '../agent';
import {
    buildContestAnalysisSystemPrompt, buildOverviewPrompt, buildRepairPrompt, buildStudentBatchPrompt,
} from './prompt';
import {
    ContestAnalysisReportError, createScopeIndex, normalizeContestReports, normalizeOverviewReport,
    normalizeStudentReports,
} from './report';
import { getContestAnalysisConfig, validateContestAnalysisConfig } from './runtime';
import { buildContestAnalysisSnapshot } from './snapshot';
import {
    CONTEST_ANALYSIS_FAILURE_ERROR, CONTEST_ANALYSIS_RETENTION_MS, CONTEST_ANALYSIS_TASK_TYPE,
    CONTEST_ANALYSIS_TIMEOUT_ERROR, CONTEST_ANALYSIS_TIMEOUT_MS, contestAnalysisOwner,
    ContestAnalysisStore, toContestAnalysisJob,
} from './store';
import {
    type AnalysisSubmission,
    createContestAnalysisTools, createOverviewSubmissionTool, createStudentSubmissionTool,
} from './tools';
import {
    type ContestAnalysisEvent, type ContestAnalysisPayload,
    type ContestAnalysisReport, type ContestAnalysisResult, type ContestAnalysisSnapshot,
    type ContestAnalysisStage, type ContestAnalysisStudentReport,
    MAX_ANALYSIS_EVENTS, STUDENT_BATCH_SIZE } from './types';

export interface ContestAnalysisJobsOptions {
    store?: ContestAnalysisStore;
    buildSnapshot?: typeof buildContestAnalysisSnapshot;
    createAgent?: (options: CreateToolAgentOptions) => Promise<AiAgentRunner>;
}

class ProgressReporter {
    private sequence: number;

    constructor(
        private readonly store: ContestAnalysisStore,
        private readonly jobId: string,
        public events: ContestAnalysisEvent[] = [],
    ) {
        this.sequence = events.reduce((max, event) => Math.max(max, event.seq), 0);
    }

    private flush(patch: Partial<ContestAnalysisPayload> = {}) {
        if (this.events.length > MAX_ANALYSIS_EVENTS) {
            this.events.splice(0, this.events.length - MAX_ANALYSIS_EVENTS);
        }
        return this.store.updatePayload(this.jobId, { events: this.events, ...patch });
    }

    stage(stage: ContestAnalysisStage, progress: number, patch: Partial<ContestAnalysisPayload> = {}) {
        return this.flush({ stage, progress, ...patch });
    }

    async start(type: ContestAnalysisEvent['type'], label: string, options: {
        detail?: string;
        tool?: string;
        code?: string;
        params?: Record<string, string | number>;
    } = {}) {
        const seq = ++this.sequence;
        this.events.push({
            seq,
            type,
            state: 'running',
            label,
            code: options.code,
            params: options.params,
            detail: options.detail,
            tool: options.tool,
            startedAt: new Date().toISOString(),
        });
        await this.flush();
        return seq;
    }

    async finish(seq: number, state: 'succeeded' | 'failed', detail?: string) {
        const event = this.events.find((item) => item.seq === seq);
        if (!event) return;
        event.state = state;
        event.finishedAt = new Date().toISOString();
        if (detail !== undefined) event.detail = detail;
        await this.flush();
    }
}

function friendlyToolLabel(tool: string) {
    const labels: Record<string, string> = {
        get_scope_overview: 'Reading the analysis scope',
        list_contests: 'Reading the contest list',
        get_contest: 'Reading a contest',
        list_problems: 'Reading the problem list',
        get_tag_statistics: 'Reading knowledge-point statistics',
        list_students: 'Reading the student list',
        get_student: 'Reading a student record',
        search_students: 'Searching students',
        submit_overall_analysis: 'Submitting the group review',
        submit_student_reports: 'Submitting student reports',
    };
    return labels[tool] || tool;
}

export class ContestAnalysisJobs {
    readonly store: ContestAnalysisStore;

    private service: BackgroundTaskService;

    private buildSnapshot: typeof buildContestAnalysisSnapshot;

    private createAgent: (options: CreateToolAgentOptions) => Promise<AiAgentRunner>;

    constructor(options: ContestAnalysisJobsOptions = {}) {
        this.store = options.store ?? new ContestAnalysisStore();
        this.buildSnapshot = options.buildSnapshot ?? buildContestAnalysisSnapshot;
        this.createAgent = options.createAgent ?? createToolAgent;
        this.service = new BackgroundTaskService(this.store).register({
            type: CONTEST_ANALYSIS_TASK_TYPE,
            timeoutMs: CONTEST_ANALYSIS_TIMEOUT_MS,
            retentionMs: CONTEST_ANALYSIS_RETENTION_MS,
            timeoutError: CONTEST_ANALYSIS_TIMEOUT_ERROR,
            failureError: CONTEST_ANALYSIS_FAILURE_ERROR,
            toPublic: toContestAnalysisJob,
            run: (payload, signal) => this.run(payload, signal),
        });
    }

    async submit(payload: ContestAnalysisPayload) {
        return this.service.submit(CONTEST_ANALYSIS_TASK_TYPE, contestAnalysisOwner(payload.domain), payload);
    }

    cancel(jobId: string) {
        this.service.cancel(jobId);
    }

    sweep() {
        return this.service.sweep();
    }

    dispose() {
        this.service.dispose();
    }

    private async run(payload: ContestAnalysisPayload, signal: AbortSignal): Promise<ContestAnalysisResult> {
        const jobId = payload.jobId;
        if (!jobId) throw new Error('Missing analysis job id.');
        const progress = new ProgressReporter(this.store, jobId, payload.events || []);
        const language = payload.language || 'zh';
        const config = getContestAnalysisConfig(payload.profileId);
        validateContestAnalysisConfig(config);
        let agent: { abort(): void } | undefined;
        const onAbort = () => agent?.abort();
        signal.addEventListener('abort', onAbort);
        try {
            await progress.stage('preparing', 3, { model: config.model });
            const preparing = await progress.start(
                'stage', 'Reading contest scoreboards and problem data', { code: 'prepare' },
            );
            const snapshot = await this.buildSnapshot(
                payload.domain,
                payload.tids.map((tid) => new ObjectId(tid)),
                { title: payload.title, instructions: payload.instructions },
            );
            await progress.stage('preparing', 8, { studentTotal: snapshot.students.length });
            await progress.finish(
                preparing, 'succeeded',
                `${snapshot.contests.length} contest(s) / ${snapshot.students.length} student(s)`,
            );

            const scope = createScopeIndex(snapshot);
            const { Type } = await import('@earendil-works/pi-ai');
            const systemPrompt = buildContestAnalysisSystemPrompt(language);
            const readTools = () => createContestAnalysisTools(Type, { snapshot });
            const describeToolStart = (tool: string, args: any) => {
                if (tool === 'get_student') return `uid ${args?.uid}`;
                if (tool === 'get_contest') return String(args?.tid || '');
                return args?.query ? String(args.query) : '';
            };

            const assertNotCancelled = async () => {
                if (signal.aborted) throw new ContestAnalysisReportError('cancelled');
                const latest = await this.store.findJob(payload.domain, jobId);
                if (latest?.payload?.cancelRequested) {
                    agent?.abort();
                    throw new ContestAnalysisReportError('cancelled');
                }
            };

            const runAgent = async (options: {
                kind: 'overview' | 'students';
                providerSessionId: string;
                prompt: string;
                expectedStudents?: number[];
            }) => {
                const submissions: AnalysisSubmission[] = [];
                const submissionTool = options.kind === 'overview'
                    ? createOverviewSubmissionTool(Type, submissions)
                    : createStudentSubmissionTool(Type, options.expectedStudents || [], submissions);
                const runner = await this.createAgent({
                    config,
                    providerSessionId: options.providerSessionId,
                    systemPrompt,
                    tools: [...readTools(), submissionTool],
                    providerLabel: 'AI contest analysis',
                    describeToolStart,
                    describeToolResult: (tool) => ({
                        summary: friendlyToolLabel(tool),
                    }),
                    onEvent: async (event) => {
                        if (event.phase === 'tool-start') {
                            await progress.start('tool', friendlyToolLabel(event.tool), {
                                tool: event.tool,
                                code: 'tool',
                                params: { tool: event.tool },
                                detail: event.summary,
                            });
                            return;
                        }
                        const pending = [...progress.events].reverse().find(
                            (item) => item.type === 'tool' && item.state === 'running' && item.tool === event.tool,
                        );
                        if (pending) {
                            await progress.finish(
                                pending.seq,
                                event.failed ? 'failed' : 'succeeded',
                                event.failed ? (event.error || 'Tool call failed') : undefined,
                            );
                        }
                    },
                });
                agent = runner;
                try {
                    const text = await runner.prompt(options.prompt);
                    return { submissions, text };
                } finally {
                    agent = undefined;
                }
            };

            let overview: ContestAnalysisReport['overview'] | undefined;
            let contestReports: ContestAnalysisReport['contests'] = [];
            let failure = '';
            for (let attempt = 0; attempt < 3; attempt++) {
                // eslint-disable-next-line no-await-in-loop
                await assertNotCancelled();
                // eslint-disable-next-line no-await-in-loop
                await progress.stage('overview', 12 + attempt * 3);
                // eslint-disable-next-line no-await-in-loop
                const turn = await progress.start(
                    'agent',
                    attempt === 0
                        ? 'Writing the group review'
                        : `Reworking the group review (attempt ${attempt + 1})`,
                    {
                        code: attempt === 0 ? 'overview' : 'overview_retry',
                        params: { attempt: attempt + 1 },
                    },
                );
                try {
                    // eslint-disable-next-line no-await-in-loop
                    const { submissions } = await runAgent({
                        kind: 'overview',
                        providerSessionId: `contest-analysis-${jobId}-overview-${attempt}`,
                        prompt: attempt === 0
                            ? buildOverviewPrompt({ snapshot, instructions: payload.instructions, language })
                            : buildRepairPrompt(failure, attempt),
                    });
                    const submission = submissions.shift();
                    if (!submission) {
                        throw new ContestAnalysisReportError(
                            'submit_overall_analysis was not called; call it to submit the group review.',
                        );
                    }
                    overview = normalizeOverviewReport(submission.overview, scope);
                    contestReports = normalizeContestReports(submission.contests, scope);
                    // eslint-disable-next-line no-await-in-loop
                    await progress.finish(turn, 'succeeded', `${contestReports.length} contest(s)`);
                    break;
                } catch (err) {
                    failure = err instanceof Error ? err.message : String(err);
                    // eslint-disable-next-line no-await-in-loop
                    await progress.finish(turn, 'failed', failure);
                    if (attempt === 2) throw new ContestAnalysisReportError(`Group review failed: ${failure}`);
                }
            }
            if (!overview) throw new ContestAnalysisReportError('The group review produced no valid result.');

            const studentReports: ContestAnalysisStudentReport[] = [];
            const batches: ContestAnalysisSnapshot['students'][number][][] = [];
            for (let index = 0; index < snapshot.students.length; index += STUDENT_BATCH_SIZE) {
                batches.push(snapshot.students.slice(index, index + STUDENT_BATCH_SIZE));
            }
            if (payload.includeStudents && batches.length) {
                await progress.stage('students', 45, { studentTotal: snapshot.students.length, studentDone: 0 });
                for (const [index, batch] of batches.entries()) {
                    // eslint-disable-next-line no-await-in-loop
                    await assertNotCancelled();
                    const uids = batch.map((student) => student.uid);
                    const baseProgress = 45 + Math.round((index / batches.length) * 50);
                    // eslint-disable-next-line no-await-in-loop
                    await progress.stage('students', baseProgress, { studentDone: index * STUDENT_BATCH_SIZE });
                    // eslint-disable-next-line no-await-in-loop
                    const turn = await progress.start(
                        'agent',
                        `Writing student reports (batch ${index + 1}/${batches.length})`,
                        { code: 'student_batch', params: { index: index + 1, total: batches.length } },
                    );
                    let batchFailure = '';
                    let done = false;
                    for (let attempt = 0; attempt < 3 && !done; attempt++) {
                        try {
                            // eslint-disable-next-line no-await-in-loop
                            await assertNotCancelled();
                            // eslint-disable-next-line no-await-in-loop
                            const { submissions } = await runAgent({
                                kind: 'students',
                                providerSessionId: `contest-analysis-${jobId}-students-${index}-${attempt}`,
                                expectedStudents: uids,
                                prompt: attempt === 0
                                    ? buildStudentBatchPrompt({
                                        snapshot,
                                        students: batch,
                                        batchIndex: index,
                                        batchTotal: batches.length,
                                        instructions: payload.instructions,
                                        language,
                                    })
                                    : buildRepairPrompt(batchFailure, attempt),
                            });
                            const submission = submissions.shift();
                            if (!submission) {
                                throw new ContestAnalysisReportError(
                                    'submit_student_reports was not called; call it with one entry per uid in this batch.',
                                );
                            }
                            studentReports.push(...normalizeStudentReports(submission.students, scope, uids));
                            done = true;
                        } catch (err) {
                            batchFailure = err instanceof Error ? err.message : String(err);
                            if (attempt === 2) {
                                // eslint-disable-next-line no-await-in-loop
                                await progress.finish(turn, 'failed', batchFailure);
                                throw new ContestAnalysisReportError(
                                    `Student report batch ${index + 1} failed: ${batchFailure}`,
                                );
                            }
                        }
                    }
                    // eslint-disable-next-line no-await-in-loop
                    await progress.finish(turn, 'succeeded', `uid ${uids.join(', ')}`);
                }
            }

            await progress.stage('finalizing', 97, { studentDone: snapshot.students.length });
            const finalizing = await progress.start(
                'stage', 'Assembling the analysis report', { code: 'finalize' },
            );
            const order = new Map(snapshot.students.map((student, index) => [student.uid, index]));
            const report: ContestAnalysisReport = {
                version: snapshot.version,
                overview,
                contests: contestReports,
                students: studentReports.sort((left, right) => (order.get(left.uid) || 0) - (order.get(right.uid) || 0)),
            };
            const result: ContestAnalysisResult = { snapshot, report };
            const size = Buffer.byteLength(JSON.stringify(result), 'utf8');
            if (size > 8_000_000) {
                throw new ContestAnalysisReportError(
                    'The analysis result exceeded the storage limit; reduce the number of contests or students.',
                );
            }
            await progress.finish(finalizing, 'succeeded', `${Math.round(size / 1024)} KB`);
            await progress.stage('done', 100, { studentDone: snapshot.students.length });
            return result;
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
    }
}
