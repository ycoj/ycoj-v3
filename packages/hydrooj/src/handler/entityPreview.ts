import { ObjectId } from 'mongodb';
import Schema from 'schemastery';
import type { Context } from '../context';
import {
    ContestNotFoundError, NotAssignedError, ProblemNotFoundError, TrainingNotFoundError, UserNotFoundError, ValidationError,
} from '../error';
import {
    buildContestPreview, buildHomeworkPreview, buildProblemPreview, buildTrainingPreview, buildUserPreview,
    CONTEST_PREVIEW_FIELDS, PROBLEM_PREVIEW_FIELDS, TRAINING_EXCERPT_SAMPLE,
    USER_PREVIEW_PROJECTION, USER_WALLET_PROJECTION,
} from '../lib/entityPreview';
import { PERM } from '../model/builtin';
import { getPublishedUserRating } from '../model/contestRating';
import domain from '../model/domain';
import * as document from '../model/document';
import problem from '../model/problem';
import * as training from '../model/training';
import user, { collV } from '../model/user';
import db from '../service/db';
import { Query } from '../service/server';

const KINDS = ['problem', 'contest', 'homework', 'training', 'user'] as const;
type PreviewKind = typeof KINDS[number];

const OBJECT_ID = /^[a-f0-9]{24}$/i;

type PreviewUser = {
    _id: number;
    group?: string[];
    own: (doc: { owner?: number, maintainer?: number[] }) => boolean;
    hasPerm: (perm: bigint) => boolean;
};

type PreviewContext = {
    domain: { _id: string };
    user: PreviewUser;
    checkPerm: (...perms: bigint[]) => void;
};

function domainIdOf(ctx: PreviewContext) {
    return ctx.domain?._id || 'system';
}

function assertKind(kind: string): PreviewKind {
    if ((KINDS as readonly string[]).includes(kind)) return kind as PreviewKind;
    throw new ValidationError('kind');
}

function assertId(id: string) {
    if (!id || id.includes('/') || id.includes('\\')) throw new ValidationError('id');
}

function objectId(id: string) {
    if (!OBJECT_ID.test(id)) return null;
    return new ObjectId(id);
}

async function assertAssigned(
    ctx: PreviewContext,
    tdoc: { owner?: number, maintainer?: number[], assign?: string[], docId: unknown },
    hiddenPerm: bigint,
    label: string,
) {
    if (!tdoc.assign?.length || ctx.user.own(tdoc) || ctx.user.hasPerm(hiddenPerm)) return;
    const groups = label === 'homework'
        ? (ctx.user.group || [])
        : (await user.listGroup(domainIdOf(ctx), ctx.user._id)).map((group) => group.name);
    if (!groups.some((name) => tdoc.assign.includes(name))) throw new NotAssignedError(label, tdoc.docId);
}

async function loadProblem(ctx: PreviewContext, id: string) {
    ctx.checkPerm(PERM.PERM_VIEW_PROBLEM);
    const domainId = domainIdOf(ctx);
    const pdoc = await problem.get(domainId, id, PROBLEM_PREVIEW_FIELDS as any);
    if (!pdoc) throw new ProblemNotFoundError(domainId, id);
    if (pdoc.hidden && !ctx.user.own(pdoc)) ctx.checkPerm(PERM.PERM_VIEW_PROBLEM_HIDDEN);
    return buildProblemPreview(id, pdoc);
}

async function loadContest(ctx: PreviewContext, id: string, kind: 'contest' | 'homework') {
    const hiddenPerm = kind === 'homework' ? PERM.PERM_VIEW_HIDDEN_HOMEWORK : PERM.PERM_VIEW_HIDDEN_CONTEST;
    ctx.checkPerm(kind === 'homework' ? PERM.PERM_VIEW_HOMEWORK : PERM.PERM_VIEW_CONTEST);
    const domainId = domainIdOf(ctx);
    const tid = objectId(id);
    if (!tid) throw new ContestNotFoundError(domainId, id);
    const tdoc = await document.get(domainId, document.TYPE_CONTEST, tid, CONTEST_PREVIEW_FIELDS as any);
    if (!tdoc) throw new ContestNotFoundError(domainId, id);
    const isHomework = tdoc.rule === 'homework';
    if (kind === 'homework' ? !isHomework : isHomework) throw new ContestNotFoundError(domainId, id);
    await assertAssigned(ctx, tdoc, hiddenPerm, kind);
    return kind === 'homework' ? buildHomeworkPreview(tdoc) : buildContestPreview(tdoc);
}

/**
 * Reads the training shell only. The detail handler also loads every problem,
 * enrollee directory, and may write progress; a hover must not do that.
 */
async function loadTraining(ctx: PreviewContext, id: string) {
    ctx.checkPerm(PERM.PERM_VIEW_TRAINING);
    const domainId = domainIdOf(ctx);
    const tid = objectId(id);
    if (!tid) throw new TrainingNotFoundError(domainId, id);
    const [tdoc, tsdoc] = await Promise.all([
        document.coll.find({ domainId, docType: document.TYPE_TRAINING, docId: tid }).project({
            docId: 1,
            title: 1,
            attend: 1,
            dag: 1,
            excerpt: { $substrCP: [{ $ifNull: ['$content', ''] }, 0, TRAINING_EXCERPT_SAMPLE] },
        }).limit(1).toArray().then((docs) => docs[0]),
        training.getStatus(domainId, tid, ctx.user._id),
    ]);
    if (!tdoc) throw new TrainingNotFoundError(domainId, id);
    return buildTrainingPreview(tdoc, tsdoc);
}

/**
 * Reads the public profile shell. The detail page also loads every accepted
 * problem, contest history, and may settle ratings; a hover must not do that.
 */
async function loadUser(ctx: PreviewContext, id: string) {
    ctx.checkPerm(PERM.PERM_VIEW);
    const domainId = domainIdOf(ctx);
    if (!/^-?\d+$/.test(id)) throw new UserNotFoundError(id);
    const uid = Number(id);
    if (!Number.isSafeInteger(uid) || uid === 0) throw new UserNotFoundError(uid);
    const source = uid < -999 ? collV : user.coll;
    const canRate = ctx.user.hasPerm(PERM.PERM_VIEW_CONTEST_SCOREBOARD);
    const [udoc, wallet, rating] = await Promise.all([
        source.find({ _id: uid }).project(USER_PREVIEW_PROJECTION).limit(1).toArray().then((rows) => rows[0]),
        db.collection('reward.wallet').find({ _id: uid }).project(USER_WALLET_PROJECTION).limit(1).toArray()
            .then((rows) => rows[0]),
        canRate ? getPublishedUserRating(domainId, uid) : Promise.resolve(null),
    ]);
    if (!udoc?.uname) throw new UserNotFoundError(uid);
    const membership = await domain.getDomainUser(domainId, { _id: uid, priv: udoc.priv || 0 });
    return buildUserPreview(udoc, membership, {
        equipment: wallet?.equipped,
        rating,
    });
}

export async function loadEntityPreview(ctx: PreviewContext, args: { kind?: string, id?: string }) {
    const kind = assertKind(args.kind || '');
    const id = args.id || '';
    assertId(id);
    switch (kind) {
        case 'problem':
            return loadProblem(ctx, id);
        case 'contest':
            return loadContest(ctx, id, 'contest');
        case 'homework':
            return loadContest(ctx, id, 'homework');
        case 'training':
            return loadTraining(ctx, id);
        case 'user':
            return loadUser(ctx, id);
        default: {
            const unexpected: never = kind;
            return unexpected;
        }
    }
}

export const EntityPreviewApi = {
    'entity.preview': Query(
        Schema.object({
            kind: Schema.string().required(),
            id: Schema.string().max(128).required(),
        }),
        (ctx, args) => loadEntityPreview(ctx, args),
    ),
} as const;

declare module '@hydrooj/framework' {
    interface Apis {
        entityPreview: typeof EntityPreviewApi;
    }
}

export async function apply(ctx: Context) {
    await ctx.inject(['api'], ({ api }) => {
        api.provide(EntityPreviewApi);
    });
}
