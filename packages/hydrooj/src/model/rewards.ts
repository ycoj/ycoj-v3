import type { Document } from 'mongodb';
import { ObjectId } from 'mongodb';
import { Context } from '../context';
import type { RewardAction, RewardProgress, RewardWallet } from '../lib/rewards';
import {
    createRewardWallet, mutateRewardWallet, REWARD_CATALOG, rewardPeriod, rewardTasks,
} from '../lib/rewards';
import db from '../service/db';
import { STATUS } from './builtin';
import * as checkin from './checkin';
import * as document from './document';
import RecordModel from './record';
import UserModel from './user';

declare module '../service/db' {
    interface Collections { 'reward.wallet': RewardWallet }
}

export const coll = db.collection('reward.wallet');
const repository = {
    async get(uid: number, now: Date) {
        try {
            await coll.updateOne({ _id: uid }, { $setOnInsert: createRewardWallet(uid, now) }, { upsert: true });
        } catch (error) {
            if ((error as { code?: number }).code !== 11000) throw error;
        }
        return coll.findOne({ _id: uid });
    },
    async replace(previous: RewardWallet, next: RewardWallet) {
        const result = await coll.replaceOne({ _id: previous._id, version: previous.version }, next);
        return result.modifiedCount === 1;
    },
};

const normalRecord = {
    contest: { $nin: [RecordModel.RECORD_PRETEST, RecordModel.RECORD_GENERATE] },
    hackTarget: { $exists: false },
};
function firstBySource(): Document[] {
    return [
        { $sort: { _id: 1 } },
        {
            $group: {
                _id: { domainId: '$domainId', pid: '$pid' },
                rid: { $first: '$_id' }, rejudged: { $first: '$rejudged' },
                contest: { $first: '$contest' }, domainId: { $first: '$domainId' },
            },
        },
        {
            $lookup: {
                from: document.coll.collectionName,
                let: { domain: '$_id.domainId', pid: '$_id.pid' },
                pipeline: [
                    { $match: { docType: document.TYPE_PROBLEM, $expr: { $and: [
                        { $eq: ['$domainId', '$$domain'] }, { $eq: ['$docId', '$$pid'] },
                    ] } } },
                    { $project: { reference: 1 } },
                ],
                as: 'problem',
            },
        },
        { $unwind: { path: '$problem', preserveNullAndEmptyArrays: true } },
        { $sort: { rid: 1 } },
        {
            $group: {
                _id: { $concat: [
                    { $ifNull: ['$problem.reference.domainId', '$_id.domainId'] }, '/',
                    { $toString: { $ifNull: ['$problem.reference.pid', '$_id.pid'] } },
                ] },
                rid: { $first: '$rid' }, rejudged: { $first: '$rejudged' },
                contest: { $first: '$contest' }, domainId: { $first: '$domainId' },
            },
        },
    ];
}

/** Reward progress must not disclose verdicts from live or hidden contests. */
function visibleContext(now: Date): Document[] {
    return [
        {
            $lookup: {
                from: document.coll.collectionName,
                let: { domain: '$domainId', tid: '$contest' },
                pipeline: [
                    { $match: {
                        docType: document.TYPE_CONTEST,
                        endAt: { $lte: now }, keepScoreboardHidden: { $ne: true },
                        $expr: { $and: [{ $eq: ['$domainId', '$$domain'] }, { $eq: ['$docId', '$$tid'] }] },
                    } },
                    { $project: { _id: 1 } },
                ],
                as: 'rewardContest',
            },
        },
        { $match: { $or: [{ contest: null }, { 'rewardContest.0': { $exists: true } }] } },
    ];
}

export async function getProgress(uid: number, now = new Date()): Promise<RewardProgress> {
    const { date, week } = rewardPeriod(now);
    const start = ObjectId.createFromTime(new Date(`${week}T00:00:00+08:00`).getTime() / 1000);
    const end = ObjectId.createFromTime(Math.floor(now.getTime() / 1000) + 1);
    // Lifetime first acceptance prevents farming previously solved or referenced problems.
    const [firstSolves, today] = await Promise.all([
        RecordModel.coll.aggregate<{ _id: string, rid: ObjectId, rejudged?: boolean }>([
            { $match: { uid, status: STATUS.STATUS_ACCEPTED, ...normalRecord, _id: { $lt: end } } },
            ...firstBySource(),
            { $match: { rid: { $gte: start, $lt: end }, rejudged: { $ne: true } } },
            ...visibleContext(now),
        ]).toArray(),
        checkin.getByDate(uid, date),
    ]);
    const daily = firstSolves.filter((s) => rewardPeriod(s.rid.getTimestamp()).date === date);
    const failed = daily.length ? await RecordModel.coll.aggregate<{ _id: string, rid: ObjectId }>([
        {
            $match: {
                uid, ...normalRecord,
                status: { $in: [
                    STATUS.STATUS_WRONG_ANSWER, STATUS.STATUS_TIME_LIMIT_EXCEEDED,
                    STATUS.STATUS_MEMORY_LIMIT_EXCEEDED, STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED,
                    STATUS.STATUS_RUNTIME_ERROR, STATUS.STATUS_COMPILE_ERROR,
                ] },
                _id: { $lt: end },
            },
        },
        ...firstBySource(),
        { $match: { _id: { $in: daily.map((s) => s._id) } } },
        ...visibleContext(now),
    ]).toArray() : [];
    return {
        checkin: today ? 1 : 0,
        'first-solve': daily.length,
        'three-solves': daily.length,
        comeback: daily.some((s) => failed.some((f) => f._id === s._id && f.rid.toHexString() < s.rid.toHexString())) ? 1 : 0,
        'practice-days': new Set(firstSolves.map((s) => rewardPeriod(s.rid.getTimestamp()).date)).size,
        'eight-solves': firstSolves.length,
    };
}

export async function get(uid: number) {
    const now = new Date();
    const [wallet, progress] = await Promise.all([repository.get(uid, now), getProgress(uid, now)]);
    return {
        date: rewardPeriod(now).date, week: rewardPeriod(now).week, timezone: 'Asia/Shanghai',
        wallet: {
            balance: wallet.balance, earned: wallet.earned, spent: wallet.spent,
            owned: wallet.owned, equipped: wallet.equipped, ledger: wallet.ledger,
        },
        tasks: rewardTasks(wallet, progress, now), catalog: REWARD_CATALOG,
    };
}

export async function act(uid: number, action: RewardAction) {
    await mutateRewardWallet(repository, uid, action, () => getProgress(uid));
    if (action.action === 'equip' || action.action === 'unequip') {
        const user = await UserModel.coll.findOne({ _id: uid });
        UserModel._deleteUserCache(user);
    }
    return get(uid);
}

export function apply(ctx: Context) {
    ctx.on('user/get', async (user) => {
        if (user._id <= 0) return;
        const wallet = await coll.findOne({ _id: user._id }, { projection: { equipped: 1 } });
        user.rewardEquipment = wallet?.equipped || {};
        user._publicFields.push('rewardEquipment');
    });
    return db.ensureIndexes(RecordModel.coll, { key: { uid: 1, status: 1, _id: 1 }, name: 'rewardProgress' });
}
