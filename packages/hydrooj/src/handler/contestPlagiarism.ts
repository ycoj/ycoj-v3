import { ObjectId } from 'mongodb';
import { Context } from '../context';
import {
    ContestNotEndedError, ContestNotFoundError, CreateError as createError, NotFoundError, UserFacingError,
} from '../error';
import type { Tdoc } from '../interface';
import { ContestPlagiarismJobs } from '../lib/plagiarism/contest/jobs';
import { PLAGIARISM_TASK_INDEXES } from '../lib/plagiarism/contest/store';
import { PERM } from '../model/builtin';
import * as contest from '../model/contest';
import { Handler, route, Types } from '../service/server';

const PlagiarismCapacityError = createError(
    'PlagiarismCapacityError', UserFacingError,
    'Plagiarism check capacity reached. Please try again later.', 503,
);

declare module 'cordis' {
    interface Context {
        contestPlagiarismJobs: ContestPlagiarismJobs;
    }
}

export async function resolvePlagiarismContest(
    handler: Pick<Handler, 'user' | 'checkPerm'>, domainId: string, tid: ObjectId,
): Promise<Tdoc> {
    const tdoc = await contest.get(domainId, tid);
    if (!tdoc) throw new ContestNotFoundError(domainId, tid);
    if (!handler.user.own(tdoc)) handler.checkPerm(PERM.PERM_EDIT_CONTEST);
    if (!contest.isDone(tdoc)) throw new ContestNotEndedError(domainId, tid);
    return tdoc;
}

function getJobs(handler: Handler) {
    const jobs = handler.ctx.get('contestPlagiarismJobs');
    if (!jobs) throw new Error('Contest plagiarism job runner is not registered.');
    return jobs;
}

export class ContestPlagiarismHandler extends Handler {
    @route('tid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId) {
        const tdoc = await resolvePlagiarismContest(this, domainId, tid);
        const job = await getJobs(this).latest({ domainId, contestId: tid.toHexString() });
        this.response.type = 'application/json';
        this.response.body = { tdoc, job };
    }

    @route('tid', Types.ObjectId)
    async post(domainId: string, tid: ObjectId) {
        const tdoc = await resolvePlagiarismContest(this, domainId, tid);
        const result = await getJobs(this).submit({
            domainId, contestId: tid.toHexString(), actorUid: this.user._id,
            beginAt: tdoc.beginAt.toISOString(), endAt: tdoc.endAt.toISOString(), pids: tdoc.pids,
        });
        if (!result) throw new PlagiarismCapacityError();
        this.response.status = 202;
        this.response.type = 'application/json';
        this.response.body = result;
    }
}

export class ContestPlagiarismJobHandler extends Handler {
    @route('tid', Types.ObjectId)
    @route('jobId', Types.String)
    async get(domainId: string, tid: ObjectId, jobId: string) {
        await resolvePlagiarismContest(this, domainId, tid);
        const result = await getJobs(this).get(jobId, { domainId, contestId: tid.toHexString() });
        if (!result) throw new NotFoundError(jobId);
        this.response.type = 'application/json';
        this.response.body = result;
    }
}

export class ContestPlagiarismSourceHandler extends Handler {
    @route('tid', Types.ObjectId)
    @route('jobId', Types.String)
    @route('rid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId, jobId: string, rid: ObjectId) {
        await resolvePlagiarismContest(this, domainId, tid);
        const result = await getJobs(this).source(jobId, { domainId, contestId: tid.toHexString() }, rid.toHexString());
        if (!result) throw new NotFoundError(rid);
        this.response.type = 'application/json';
        this.response.body = result;
    }
}

export async function apply(ctx: Context) {
    const provided = ctx.get('contestPlagiarismJobs');
    const jobs = provided ?? new ContestPlagiarismJobs();
    await ctx.db.ensureIndexes(jobs.store.coll, ...PLAGIARISM_TASK_INDEXES);
    if (!provided) ctx.provide('contestPlagiarismJobs', jobs);
    ctx.effect(() => () => jobs.dispose());
    await jobs.sweep();
    if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
        ctx.effect(() => {
            const timer = setInterval(() => void jobs.sweep(), 60_000);
            timer.unref();
            return () => clearInterval(timer);
        });
    }
    ctx.Route('contest_plagiarism', '/contest/:tid/plagiarism', ContestPlagiarismHandler);
    ctx.Route('contest_plagiarism_job', '/contest/:tid/plagiarism/:jobId', ContestPlagiarismJobHandler);
    ctx.Route('contest_plagiarism_source', '/contest/:tid/plagiarism/:jobId/source/:rid', ContestPlagiarismSourceHandler);
}
