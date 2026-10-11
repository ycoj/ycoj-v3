import { ObjectId } from 'mongodb';
import type { Readable } from 'stream';
import { STATUS } from '../../../model/builtin';
import * as contest from '../../../model/contest';
import problem from '../../../model/problem';
import record from '../../../model/record';
import storage from '../../../model/storage';
import user from '../../../model/user';
import type { PlagiarismRequest, PlagiarismSnapshot, PlagiarismSubmission } from './types';

export const PLAGIARISM_MAX_SOURCE_BYTES = 65_536;
export const PLAGIARISM_MAX_PARTICIPANTS = 20;
export const PLAGIARISM_MAX_PROBLEMS = 4;
export class PlagiarismInputError extends Error { }

interface SubmissionRecord {
    _id: ObjectId;
    uid: number;
    pid: number;
    lang: string;
    code?: string;
    files?: Record<string, string>;
}

export async function readSubmissionSource(
    submission: Pick<SubmissionRecord, 'code' | 'files'>,
    signal: AbortSignal,
    readStorage: (path: string) => Promise<Readable> = (path) => storage.get(path),
) {
    if (signal.aborted) throw new Error('aborted');
    if (!submission.files?.code) {
        if (!submission.code?.trim()) throw new PlagiarismInputError('Source code is empty or unavailable.');
        if (Buffer.byteLength(submission.code, 'utf8') > PLAGIARISM_MAX_SOURCE_BYTES) {
            throw new PlagiarismInputError('Source code exceeds the 64 KiB analysis limit.');
        }
        return submission.code;
    }
    const id = submission.files.code.split('#')[0];
    if (!id) throw new PlagiarismInputError('Stored source code is unavailable.');
    const stream = await new Promise<Readable>((resolve, reject) => {
        const abortOpen = () => reject(new Error('aborted'));
        signal.addEventListener('abort', abortOpen, { once: true });
        void readStorage(`submission/${id}`).then((opened) => {
            signal.removeEventListener('abort', abortOpen);
            if (signal.aborted) {
                opened.destroy();
                reject(new Error('aborted'));
            } else resolve(opened);
        }, (error) => {
            signal.removeEventListener('abort', abortOpen);
            reject(error);
        });
    });
    const abort = () => stream.destroy(new Error('aborted'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    let bytes = 0;
    const chunks: Buffer[] = [];
    try {
        for await (const chunk of stream) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buffer.length;
            if (bytes > PLAGIARISM_MAX_SOURCE_BYTES) {
                throw new PlagiarismInputError('Source code exceeds the 64 KiB analysis limit.');
            }
            chunks.push(buffer);
        }
        const code = Buffer.concat(chunks).toString('utf8');
        if (Buffer.byteLength(code, 'utf8') > PLAGIARISM_MAX_SOURCE_BYTES) {
            throw new PlagiarismInputError('Source code exceeds the 64 KiB analysis limit.');
        }
        if (!code.trim()) throw new PlagiarismInputError('Source code is empty or unavailable.');
        return code;
    } finally {
        signal.removeEventListener('abort', abort);
        stream.destroy();
    }
}

export async function loadPlagiarismSnapshot(request: PlagiarismRequest, signal: AbortSignal): Promise<PlagiarismSnapshot> {
    const pids = [...new Set(request.pids)];
    if (pids.length > PLAGIARISM_MAX_PROBLEMS) {
        throw new PlagiarismInputError('Plagiarism checks support contests with at most four problems.');
    }
    const tid = new ObjectId(request.contestId);
    const beginAt = new Date(request.beginAt);
    const endAt = new Date(request.endAt);
    const participants = await contest.getMultiStatus(request.domainId, { docId: tid, attend: 1 })
        .project<{ uid: number }>({ uid: 1 }).limit(PLAGIARISM_MAX_PARTICIPANTS + 1).maxTimeMS(10_000).toArray();
    if (participants.length > PLAGIARISM_MAX_PARTICIPANTS) {
        throw new PlagiarismInputError('Plagiarism checks support contests with at most 20 participants.');
    }
    // Prefer the latest C++ submission, regardless of judge outcome. Record-history revisions are
    // deliberately excluded, and grouping prevents participants from being compared with themselves.
    const selected = await record.coll.aggregate<SubmissionRecord>([
        {
            $match: {
                domainId: request.domainId,
                contest: tid,
                pid: { $in: pids },
                status: { $ne: STATUS.STATUS_CANCELED },
                'files.hack': { $exists: false },
                hackTarget: { $exists: false },
                _id: {
                    $gte: ObjectId.createFromTime(Math.floor(beginAt.getTime() / 1000)),
                    $lt: ObjectId.createFromTime(Math.ceil(endAt.getTime() / 1000)),
                },
            },
        },
        { $project: { _id: 1, uid: 1, pid: 1, lang: 1 } },
        { $addFields: { cpp: { $regexMatch: { input: '$lang', regex: '^cc(?:\\.|$)' } } } },
        { $sort: { cpp: -1, _id: -1 } },
        { $group: { _id: { uid: '$uid', pid: '$pid' }, submission: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$submission' } },
        { $limit: PLAGIARISM_MAX_PARTICIPANTS * PLAGIARISM_MAX_PROBLEMS + 1 },
    ], { maxTimeMS: 10_000 }).toArray();
    const uids = [...new Set([...participants.map((item) => item.uid), ...selected.map((item) => item.uid)])];
    if (uids.length > PLAGIARISM_MAX_PARTICIPANTS || selected.length > PLAGIARISM_MAX_PARTICIPANTS * PLAGIARISM_MAX_PROBLEMS) {
        throw new PlagiarismInputError('Plagiarism checks support contests with at most 20 participants.');
    }
    if (signal.aborted) throw new Error('aborted');
    const [records, udict, pdict] = await Promise.all([
        record.getMulti(request.domainId, { _id: { $in: selected.map((item) => item._id) } })
            .project<SubmissionRecord>({ _id: 1, uid: 1, pid: 1, lang: 1, code: 1, files: 1 }).maxTimeMS(10_000).toArray(),
        user.getList(request.domainId, uids),
        problem.getList(request.domainId, pids, true, false, ['docId', 'title']),
    ]);
    const byId = new Map(records.map((item) => [item._id.toHexString(), item]));
    const sources: PlagiarismSubmission[] = [];
    const skippedSubmissions: PlagiarismSnapshot['skippedSubmissions'] = [];
    for (const submission of selected) {
        if (signal.aborted) throw new Error('aborted');
        const rid = submission._id.toHexString();
        if (submission.lang !== 'cc' && !submission.lang.startsWith('cc.')) {
            skippedSubmissions.push({ rid, uid: submission.uid, pid: submission.pid, reason: 'Only C++ submissions are supported.' });
            continue;
        }
        try {
            const stored = byId.get(rid);
            if (!stored) throw new PlagiarismInputError('Source code is empty or unavailable.');
            // eslint-disable-next-line no-await-in-loop
            const code = await readSubmissionSource(stored, signal);
            sources.push({
                rid, uid: submission.uid, pid: submission.pid, language: submission.lang,
                submittedAt: submission._id.getTimestamp().toISOString(), code,
            });
        } catch (error) {
            if (signal.aborted) throw error;
            skippedSubmissions.push({
                rid, uid: submission.uid, pid: submission.pid,
                reason: error instanceof PlagiarismInputError ? error.message : 'Stored source code could not be read.',
            });
        }
    }
    return {
        sources,
        skippedSubmissions,
        participantCount: uids.length,
        users: Object.fromEntries(uids.map((uid) => [uid, {
            _id: uid,
            uname: udict[uid]?.uname || String(uid),
            ...(udict[uid]?.displayName ? { displayName: udict[uid].displayName } : {}),
        }])),
        problems: pids.map((pid) => ({ pid, title: pdict[pid]?.title || String(pid) })),
    };
}
