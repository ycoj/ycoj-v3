import { ObjectId } from 'mongodb';
import { Context } from '../context';
import {
    ContestNotEndedError, ContestNotFoundError, ContestScoreboardHiddenError,
    CreateError as createError, NotFoundError, UserFacingError, ValidationError,
} from '../error';
import type { Tdoc } from '../interface';
import { ContestAnalysisJobs } from '../lib/ai/contest-analysis/jobs';
import {
    getDefaultContestAnalysisProfileId, getPublicContestAnalysisProfiles, isContestAnalysisEnabled,
} from '../lib/ai/contest-analysis/runtime';
import {
    CONTEST_ANALYSIS_INDEXES, CONTEST_ANALYSIS_STARTED_ERROR,
    toContestAnalysisJob, toContestAnalysisSummary,
} from '../lib/ai/contest-analysis/store';
import {
    type ContestAnalysisLanguage, type ContestAnalysisPayload,
    MAX_ANALYSIS_CONTESTS } from '../lib/ai/contest-analysis/types';
import { PERM } from '../model/builtin';
import * as contest from '../model/contest';
import { Handler, post, route, Types } from '../service/server';

const ContestAnalysisUnavailableError = createError(
    'ContestAnalysisUnavailableError', UserFacingError,
    'AI contest analysis is not available. Ask an administrator to configure an AI model.', 503,
);

const ContestAnalysisCapacityError = createError(
    'ContestAnalysisCapacityError', UserFacingError, CONTEST_ANALYSIS_STARTED_ERROR, 409,
);

declare module 'cordis' {
    interface Context {
        contestAnalysisJobs: ContestAnalysisJobs;
    }
}

function getJobs(handler: Handler) {
    const jobs = handler.ctx.get('contestAnalysisJobs');
    if (!jobs) throw new Error('Contest analysis job runner is not registered.');
    return jobs;
}

async function loadContests(handler: Handler, domainId: string, tids: ObjectId[]): Promise<Tdoc[]> {
    const unique = [...new Map(tids.map((tid) => [tid.toHexString(), tid])).values()];
    if (!unique.length) throw new ValidationError('tids');
    if (unique.length > MAX_ANALYSIS_CONTESTS) throw new ValidationError('tids');
    const tdocs: Tdoc[] = [];
    for (const tid of unique) {
        // eslint-disable-next-line no-await-in-loop
        const tdoc = await contest.get(domainId, tid);
        if (!tdoc) throw new ContestNotFoundError(domainId, tid);
        handler.checkPerm(handler.user.own(tdoc) ? PERM.PERM_EDIT_CONTEST_SELF : PERM.PERM_EDIT_CONTEST);
        if (!contest.isDone(tdoc)) throw new ContestNotEndedError(domainId, tid);
        if (!contest.canShowScoreboard.call(handler, tdoc)) throw new ContestScoreboardHiddenError(tid);
        tdocs.push(tdoc);
    }
    return tdocs;
}

async function loadJob(handler: Handler, domainId: string, aid: string) {
    const jobs = getJobs(handler);
    const doc = await jobs.store.viewJob(domainId, aid);
    if (!doc) throw new NotFoundError(aid);
    const payload = doc.payload as ContestAnalysisPayload | undefined;
    if (payload?.actorUid !== handler.user._id) handler.checkPerm(PERM.PERM_EDIT_CONTEST);
    return doc;
}

function initialEvent(code: 'created' | 'recreated') {
    const now = new Date().toISOString();
    return [{
        seq: 1,
        type: 'stage' as const,
        state: 'succeeded' as const,
        label: code === 'created' ? 'Job created, waiting for a worker' : 'Job re-created, waiting for a worker',
        code,
        startedAt: now,
        finishedAt: now,
    }];
}

export class ContestAnalysisHandler extends Handler {
    async get(domainId: string) {
        const canManage = this.user.hasPerm(PERM.PERM_EDIT_CONTEST);
        const jobs = getJobs(this);
        const docs = await jobs.store.list(domainId, 60);
        const visible = docs.filter((doc) => (
            canManage || (doc.payload as ContestAnalysisPayload | undefined)?.actorUid === this.user._id
        ));
        // Model profiles are only useful to users who may start an analysis.
        const canRequest = this.user.hasPerm(PERM.PERM_EDIT_CONTEST)
            || this.user.hasPerm(PERM.PERM_EDIT_CONTEST_SELF);
        const profiles = canRequest ? getPublicContestAnalysisProfiles() : [];
        this.response.type = 'application/json';
        this.response.body = {
            enabled: canRequest && isContestAnalysisEnabled() && profiles.length > 0,
            profiles,
            defaultProfileId: profiles.length ? getDefaultContestAnalysisProfileId() : '',
            jobs: visible.slice(0, 30).map((doc) => toContestAnalysisSummary(doc)),
        };
    }

    @post('tids', Types.ArrayOf(Types.ObjectId))
    @post('title', Types.String, true)
    @post('instructions', Types.String, true)
    @post('includeStudents', Types.Boolean, true)
    @post('profileId', Types.String, true)
    @post('language', Types.Range(['zh', 'en']), true)
    async post(
        domainId: string, tids: ObjectId[], title?: string, instructions?: string,
        includeStudents = true, profileId?: string, language: ContestAnalysisLanguage = 'zh',
    ) {
        if (!isContestAnalysisEnabled()) throw new ContestAnalysisUnavailableError();
        const profiles = getPublicContestAnalysisProfiles();
        if (!profiles.length) throw new ContestAnalysisUnavailableError();
        const selectedProfileId = profileId || getDefaultContestAnalysisProfileId();
        if (!profiles.some((profile) => profile.id === selectedProfileId)) throw new ValidationError('profileId');
        if (typeof instructions === 'string' && instructions.length > 2000) throw new ValidationError('instructions');
        if (title && title.length > 100) throw new ValidationError('title');
        const tdocs = await loadContests(this, domainId, tids);
        const jobs = getJobs(this);
        const scopeTitle = title || tdocs.map((tdoc) => tdoc.title).join(' · ');
        const payload: ContestAnalysisPayload = {
            domain: domainId,
            tids: tdocs.map((tdoc) => tdoc.docId.toHexString()),
            title: scopeTitle,
            instructions: instructions || '',
            includeStudents: includeStudents !== false,
            actorUid: this.user._id,
            language,
            profileId: selectedProfileId,
            stage: 'waiting',
            progress: 0,
            events: initialEvent('created'),
            scope: {
                title: scopeTitle,
                contests: tdocs.map((tdoc) => ({
                    tid: tdoc.docId.toHexString(),
                    title: tdoc.title,
                    beginAt: tdoc.beginAt.toISOString(),
                    problemCount: tdoc.pids.length,
                    participantCount: tdoc.attend || 0,
                })),
                problemCount: tdocs.reduce((sum, tdoc) => sum + tdoc.pids.length, 0),
                studentCount: tdocs.reduce((sum, tdoc) => sum + (tdoc.attend || 0), 0),
            },
        };
        const result = await jobs.submit(payload);
        if (!result) throw new ContestAnalysisCapacityError();
        this.response.status = 202;
        this.response.type = 'application/json';
        this.response.body = { jobId: result.jobId };
    }
}

export class ContestAnalysisJobHandler extends Handler {
    @route('aid', Types.String)
    async get(domainId: string, aid: string) {
        const doc = await loadJob(this, domainId, aid);
        const payload = doc.payload as ContestAnalysisPayload | undefined;
        const canManage = this.user.hasPerm(PERM.PERM_EDIT_CONTEST) || payload?.actorUid === this.user._id;
        this.response.type = 'application/json';
        this.response.body = { job: toContestAnalysisJob(doc), canManage };
    }

    @route('aid', Types.String)
    @post('operation', Types.Range(['cancel', 'delete', 'retry']))
    async post(domainId: string, aid: string, operation: 'cancel' | 'delete' | 'retry') {
        const doc = await loadJob(this, domainId, aid);
        const jobs = getJobs(this);
        const payload = doc.payload as ContestAnalysisPayload | undefined;
        if (operation === 'cancel') {
            if (doc.status === 'pending' || doc.status === 'running') {
                await jobs.store.requestCancel(aid);
                jobs.cancel(aid);
            }
            this.response.type = 'application/json';
            this.response.body = { ok: true };
            return;
        }
        if (operation === 'delete') {
            await jobs.store.removeJob(domainId, aid);
            this.response.type = 'application/json';
            this.response.body = { ok: true };
            return;
        }
        if (!isContestAnalysisEnabled()) throw new ContestAnalysisUnavailableError();
        if (!payload?.tids?.length) throw new ValidationError('job');
        await loadContests(this, domainId, payload.tids.map((tid) => new ObjectId(tid)));
        const profiles = getPublicContestAnalysisProfiles();
        const profileId = payload.profileId && profiles.some((item) => item.id === payload.profileId)
            ? payload.profileId : getDefaultContestAnalysisProfileId();
        if (!profiles.length || !profileId) throw new ContestAnalysisUnavailableError();
        const result = await jobs.submit({
            domain: domainId,
            tids: payload.tids,
            title: payload.title,
            instructions: payload.instructions,
            includeStudents: payload.includeStudents,
            actorUid: this.user._id,
            language: payload.language,
            profileId,
            stage: 'waiting',
            progress: 0,
            events: initialEvent('recreated'),
            scope: payload.scope,
        });
        if (!result) throw new ContestAnalysisCapacityError();
        this.response.status = 202;
        this.response.type = 'application/json';
        this.response.body = { jobId: result.jobId };
    }
}

export async function apply(ctx: Context) {
    const provided = ctx.get('contestAnalysisJobs');
    const jobs = provided ?? new ContestAnalysisJobs();
    await ctx.db.ensureIndexes(jobs.store.coll, ...CONTEST_ANALYSIS_INDEXES);
    if (!provided) ctx.provide('contestAnalysisJobs', jobs);
    ctx.effect(() => () => jobs.dispose());
    await jobs.sweep();
    if (!process.env.NODE_APP_INSTANCE || process.env.NODE_APP_INSTANCE === '0') {
        ctx.effect(() => {
            const timer = setInterval(() => void jobs.sweep(), 60_000);
            timer.unref();
            return () => clearInterval(timer);
        });
    }
    // Routes are registered from handler/contest.ts so that the literal `/contest/analysis`
    // path wins over the earlier `/contest/:tid` route regardless of file load order.
}
