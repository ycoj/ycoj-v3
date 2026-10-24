/* eslint-disable no-await-in-loop */
import { createHash, randomUUID } from 'crypto';
import type { Context } from '../context';
import type { Tdoc } from '../interface';
import {
    ContestRatingEngine, isRatingPopulation, RATING_PARAMETERS, RATING_POPULATIONS, RATING_VERSION,
    type RatingChange, type RatingParticipant, type RatingPopulation, type RatingSummary,
} from '../lib/contestRating';
import { leaderboardUidClause } from '../lib/rankVisibility';
import db from '../service/db';
import { STATUS } from './builtin';
import * as contest from './contest';
import RecordModel from './record';
import ScheduleModel from './schedule';
import { deleteUserCache } from './user';

export type RatingHistory = RatingChange & { tid: string, title: string, endAt: string };
export interface ContestRatingResult { status: 'settled' | 'skipped', changes: RatingChange[] }
interface SnapshotRow {
    _id: string;
    domainId: string;
    generation?: string;
    fingerprint?: string;
    updatedAt?: Date;
    modelVersion?: number;
    parameters?: typeof RATING_PARAMETERS;
    populations?: typeof RATING_POPULATIONS;
    inputs?: { tid: string, title: string, endAt: string, population: RatingPopulation, participants: RatingParticipant[] }[];
    user?: RatingSummary & { history: RatingHistory[] };
    contest?: ContestRatingResult;
}
declare module '../service/db' {
    interface Collections { 'contest.rating': SnapshotRow }
}
const coll = db.collection('contest.rating');
const running = new Map<string, Promise<string>>();
const pendingStatuses = [STATUS.STATUS_WAITING, STATUS.STATUS_FETCHED, STATUS.STATUS_COMPILING, STATUS.STATUS_JUDGING];

export function ratingContestEligible(
    tdoc: Pick<Tdoc, 'rated' | 'rule' | 'endAt' | 'beginAt' | 'lockAt' | 'unlocked' | 'keepScoreboardHidden'>, now = new Date(),
) {
    return !!tdoc.rated && ['acm', 'oi', 'ioi', 'strictioi', 'ledo'].includes(tdoc.rule)
        && tdoc.beginAt < tdoc.endAt && tdoc.endAt <= now && !tdoc.keepScoreboardHidden
        && (!tdoc.lockAt || !!tdoc.unlocked);
}

async function rebuild(domainId: string) {
    const existing = await coll.findOne({ _id: domainId });
    const contests = await contest.getMulti(domainId, { rated: true, endAt: { $lte: new Date() } })
        .sort({ endAt: 1, docId: 1 }).toArray();
    const inputs: { tdoc: Tdoc, participants: RatingParticipant[], population: RatingPopulation }[] = [];
    for (const tdoc of contests) {
        if (!ratingContestEligible(tdoc)) continue;
        // Rejudge may reset records before their contest journal is updated.
        if ((await RecordModel.getMulti(domainId, { contest: tdoc.docId, status: { $in: pendingStatuses } }).limit(1).toArray()).length) break;
        const cursor = contest.getMultiStatus(domainId, {
            docId: tdoc.docId, attend: { $gt: 0 }, unrank: { $ne: true }, uid: { $gt: 0 },
            'journal.0': { $exists: true },
        }).sort(contest.RULES[tdoc.rule].statusSort);
        const ranked = await contest.RULES[tdoc.rule].ranked(tdoc, cursor);
        const participants = ranked.filter(([rank, s]) => rank > 0 && s.journal?.some((j) => tdoc.pids.includes(j.pid)))
            .map(([rank, s]) => ({ uid: s.uid, rank }));
        inputs.push({ tdoc, participants, population: isRatingPopulation(tdoc.ratingPopulation) ? tdoc.ratingPopulation : 'open' });
    }
    const fingerprint = createHash('sha256').update(JSON.stringify([
        RATING_VERSION, RATING_PARAMETERS, RATING_POPULATIONS,
        inputs.map(({ tdoc, participants, population }) => [tdoc.docId, tdoc.title, tdoc.endAt, population, participants]),
    ])).digest('hex');
    if (existing?.fingerprint === fingerprint) return existing.generation;
    const engine = new ContestRatingEngine();
    const generation = randomUUID();
    const rows: SnapshotRow[] = [{
        _id: `${generation}:source`, domainId, generation, modelVersion: RATING_VERSION,
        parameters: RATING_PARAMETERS, populations: RATING_POPULATIONS,
        inputs: inputs.map(({ tdoc, participants, population }) => ({
            tid: tdoc.docId.toHexString(), title: tdoc.title, endAt: tdoc.endAt.toISOString(), population, participants,
        })),
    }];
    const histories = new Map<number, RatingHistory[]>();
    for (const { tdoc, participants, population } of inputs) {
        const changes = engine.rate(participants, population, tdoc.endAt.getTime());
        const tid = tdoc.docId.toHexString();
        rows.push({
            _id: `${generation}:contest:${tid}`, domainId, generation,
            contest: { status: changes.length ? 'settled' : 'skipped', changes },
        });
        for (const change of changes) {
            if (!histories.has(change.uid)) histories.set(change.uid, []);
            histories.get(change.uid).push({ ...change, tid, title: tdoc.title, endAt: tdoc.endAt.toISOString() });
        }
    }
    for (const { uid, ...summary } of engine.getUsers()) {
        rows.push({ _id: `${generation}:user:${uid}`, domainId, generation, user: { ...summary, history: histories.get(uid).reverse() } });
    }
    if (rows.length) await coll.insertMany(rows);
    try {
        // Publish a complete generation in one compare-and-swap; readers never see partial histories.
        const query = { _id: domainId, ...existing ? { fingerprint: existing.fingerprint } : { fingerprint: { $exists: false } } };
        const result = await coll.replaceOne(query, {
            domainId, generation, fingerprint, updatedAt: new Date(),
        }, { upsert: !existing });
        if (!result.matchedCount && !result.upsertedCount) return (await coll.findOne({ _id: domainId })).generation;
        deleteUserCache(domainId);
    } catch (error) {
        if (error.code !== 11000) throw error;
        return (await coll.findOne({ _id: domainId })).generation;
    }
    return generation;
}

export async function settleContestRatings(domainId: string) {
    if (!running.has(domainId)) running.set(domainId, rebuild(domainId).finally(() => running.delete(domainId)));
    return running.get(domainId);
}

export async function getContestRating(domainId: string, tid: string): Promise<ContestRatingResult | { status: 'pending', changes: [] }> {
    const generation = await settleContestRatings(domainId);
    return (await coll.findOne({ _id: `${generation}:contest:${tid}`, domainId }))?.contest || { status: 'pending', changes: [] };
}

export async function getUserRating(domainId: string, uid: number) {
    const generation = await settleContestRatings(domainId);
    return (await coll.findOne({ _id: `${generation}:user:${uid}`, domainId }))?.user || null;
}

export async function getPublishedUserRating(domainId: string, uid: number): Promise<RatingSummary | null> {
    const active = await coll.findOne({ _id: domainId });
    if (!active?.generation) return null;
    const summary = (await coll.findOne({ _id: `${active.generation}:user:${uid}`, domainId }, { projection: { 'user.history': 0 } }))?.user;
    if (!summary) return null;
    return { rating: summary.rating, peak: summary.peak, contests: summary.contests, provisional: summary.provisional };
}

export async function getPublishedUserRatings(domainId: string, uids: number[]): Promise<Record<number, RatingSummary | null>> {
    const result: Record<number, RatingSummary | null> = Object.fromEntries(uids.map((uid) => [uid, null]));
    const active = await coll.findOne({ _id: domainId });
    if (!active?.generation) return result;
    const ids = uids.filter((uid) => uid > 0).map((uid) => `${active.generation}:user:${uid}`);
    const summaries = await coll.find({ domainId, _id: { $in: ids } }, { projection: { 'user.history': 0 } }).toArray();
    const byId = new Map(summaries.map((row) => [row._id, row.user]));
    for (const uid of uids) {
        const summary = uid > 0 ? byId.get(`${active.generation}:user:${uid}`) : null;
        if (summary) result[uid] = { rating: summary.rating, peak: summary.peak, contests: summary.contests, provisional: summary.provisional };
    }
    return result;
}

export async function getRatingLeaderboard(domainId: string, page: number, pageSize: number, hiddenUids: number[], viewerUid?: number) {
    const generation = await settleContestRatings(domainId);
    const current = viewerUid ? await coll.findOne({ _id: `${generation}:user:${viewerUid}`, domainId }, { projection: { 'user.rating': 1 } }) : null;
    const [result] = await coll.aggregate<{
        entries: { uid: number, contestRating: RatingSummary }[]; total: { count: number }[]; ahead: { count: number }[]; self: { uid: number }[];
    }>([
        { $match: { domainId, generation, 'user.contests': { $gt: 0 } } },
        { $project: { 'user.rating': 1, 'user.peak': 1, 'user.contests': 1, 'user.provisional': 1 } },
        // The generation key also identifies summaries written before leaderboard support.
        { $set: { uid: { $toInt: { $arrayElemAt: [{ $split: ['$_id', ':'] }, -1] } } } },
        { $match: leaderboardUidClause(hiddenUids) },
        { $lookup: {
            from: db.collection('domain.user').collectionName, localField: 'uid', foreignField: 'uid',
            pipeline: [{ $match: { domainId, join: true } }, { $project: { _id: 1 } }], as: 'membership',
        } },
        { $match: { 'membership.0': { $exists: true } } },
        { $sort: { 'user.rating': -1, uid: 1 } },
        { $facet: {
            entries: [
                { $skip: (page - 1) * pageSize }, { $limit: pageSize },
                { $project: { _id: 0, uid: 1, contestRating: {
                    rating: '$user.rating', peak: '$user.peak', contests: '$user.contests', provisional: '$user.provisional',
                } } },
            ],
            total: [{ $count: 'count' }],
            self: [{ $match: { uid: viewerUid ?? -1 } }, { $project: { _id: 0, uid: 1 } }],
            ahead: [{ $match: { $or: [
                { 'user.rating': { $gt: current?.user?.rating ?? Infinity } },
                { 'user.rating': current?.user?.rating ?? Infinity, uid: { $lt: viewerUid ?? -1 } },
            ] } }, { $count: 'count' }],
        } },
    ]).toArray();
    const ucount = result.total[0]?.count || 0;
    return {
        entries: result.entries, ucount, upcount: Math.ceil(ucount / pageSize),
        selfRank: result.self.length ? 1 + (result.ahead[0]?.count || 0) : null,
    };
}

export async function apply(ctx: Context) {
    ctx.on('user/get', async (udoc) => {
        udoc.contestRating = udoc._id > 0 && udoc._dudoc.domainId
            ? await getPublishedUserRating(udoc._dudoc.domainId, udoc._id) : null;
    });
    await db.ensureIndexes(coll, { name: 'domain_generation', key: { domainId: 1, generation: 1 } });
    ctx.on('domain/delete', (domainId) => coll.deleteMany({ domainId }));
    const refresh = async () => {
        const domains = await contest.getMulti('', { rated: true }).project({ domainId: 1 }).toArray();
        for (const domainId of new Set(domains.map((tdoc) => tdoc.domainId))) await settleContestRatings(domainId);
    };
    ctx.on('task/daily', refresh);
    await ctx.inject(['worker'], async (c) => {
        c.worker.addHandler('contest.rating.refresh', refresh);
        if (process.env.NODE_APP_INSTANCE && process.env.NODE_APP_INSTANCE !== '0') return;
        const query = { type: 'schedule', subType: 'contest.rating.refresh' };
        if (!await ScheduleModel.count(query)) await ScheduleModel.add({ ...query, interval: [5, 'minutes'] });
    });
}
