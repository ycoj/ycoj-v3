import type { ObjectId } from 'mongodb';
import type {
    ContestDetailEntry, ContestJournalEntry, ProblemDoc, Tdoc,
} from '../../../interface';
import * as contest from '../../../model/contest';
import problem from '../../../model/problem';
import user from '../../../model/user';
import {
    CONTEST_ANALYSIS_VERSION, type ContestAnalysisContestFact, type ContestAnalysisProblemFact, type ContestAnalysisProblemResult,
    type ContestAnalysisSnapshot, type ContestAnalysisStudentContestResult, type ContestAnalysisStudentFact,
    type ContestAnalysisTagStat,
    MAX_ANALYSIS_CONTESTS, MAX_ANALYSIS_STUDENTS,
} from './types';

export interface RawAnalysisStudent {
    uid: number;
    score: number;
    unrank?: boolean;
    journal: ContestJournalEntry[];
    detail: Record<number, ContestDetailEntry>;
}

export interface RawAnalysisContest {
    tdoc: Tdoc;
    pdocs: ProblemDoc[];
    students: RawAnalysisStudent[];
}

export interface AnalysisSnapshotInput {
    title?: string;
    instructions?: string;
}

const SCORE_BUCKETS = 11;

/** Mirrors service/db.ranked: ties share the previous rank and unranked rows get rank 0. */
function rankStudents(students: RawAnalysisStudent[]): [number, RawAnalysisStudent][] {
    const ranked: [number, RawAnalysisStudent][] = [];
    let last: RawAnalysisStudent | null = null;
    let rank = 0;
    let count = 0;
    for (const student of students) {
        if (student.unrank) {
            ranked.push([0, student]);
            continue;
        }
        count++;
        if (!last || last.score !== student.score) rank = count;
        last = student;
        ranked.push([rank, student]);
    }
    return ranked;
}
const ROUND = (value: number) => Math.round(value * 10) / 10;

export function contestProblemMaxScore(tdoc: Pick<Tdoc, 'score'>, pid: number) {
    const configured = tdoc.score?.[pid];
    return Number.isFinite(configured) && (configured as number) > 0 ? configured as number : 100;
}

function distribution(values: number[], bucketCount: number, bucketSize: number) {
    const buckets = Array.from({ length: bucketCount }, () => 0);
    for (const value of values) {
        const index = Math.min(bucketCount - 1, Math.max(0, Math.floor(value / bucketSize)));
        buckets[index]++;
    }
    return buckets;
}

function median(values: number[]) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function buildProblemFacts(raw: RawAnalysisContest): ContestAnalysisProblemFact[] {
    const inContest = new Set(raw.tdoc.pids);
    return raw.tdoc.pids.map((pid) => {
        const pdoc = raw.pdocs.find((item) => item.docId === pid) as ProblemDoc | undefined;
        const maxScore = contestProblemMaxScore(raw.tdoc, pid);
        const scores: number[] = [];
        const scoreRates: number[] = [];
        let submissionCount = 0;
        let attemptCount = 0;
        let acceptCount = 0;
        for (const student of raw.students) {
            const journal = student.journal.filter((entry) => entry.pid === pid);
            if (!journal.length) continue;
            submissionCount += journal.length;
            attemptCount++;
            const score = (student.detail[pid]?.score || 0) * (maxScore / 100);
            scores.push(score);
            scoreRates.push(maxScore ? (score / maxScore) * 100 : 0);
            if (score >= maxScore) acceptCount++;
        }
        return {
            pid,
            title: pdoc?.title || `#${pid}`,
            difficulty: pdoc?.difficulty || 0,
            tags: (pdoc?.tag || []).map((tag) => String(tag)),
            maxScore,
            submissionCount,
            attemptCount,
            acceptCount,
            averageScore: scores.length ? ROUND(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
            scoreBuckets: distribution(scoreRates, SCORE_BUCKETS, 10),
        };
    }).filter((fact) => inContest.has(fact.pid));
}

function buildStudentContestResult(
    raw: RawAnalysisContest, student: RawAnalysisStudent, rank: number, participantCount: number,
): ContestAnalysisStudentContestResult {
    const journalByPid = new Map<number, ContestJournalEntry[]>();
    for (const entry of student.journal) {
        if (!raw.tdoc.pids.includes(entry.pid)) continue;
        const list = journalByPid.get(entry.pid) || [];
        list.push(entry);
        journalByPid.set(entry.pid, list);
    }
    const problems: ContestAnalysisProblemResult[] = [];
    let score = 0;
    let maxScore = 0;
    const solved: number[] = [];
    for (const pid of raw.tdoc.pids) {
        const pdoc = raw.pdocs.find((item) => item.docId === pid);
        const pidMax = contestProblemMaxScore(raw.tdoc, pid);
        const detail = student.detail[pid];
        const value = (detail?.score || 0) * (pidMax / 100);
        const journal = journalByPid.get(pid) || [];
        const sorted = [...journal].sort((left, right) => left.rid.getTimestamp().getTime() - right.rid.getTimestamp().getTime());
        score += value;
        maxScore += pidMax;
        if (value >= pidMax) solved.push(pid);
        problems.push({
            pid,
            title: pdoc?.title || `#${pid}`,
            difficulty: pdoc?.difficulty || 0,
            tags: (pdoc?.tag || []).map((tag) => String(tag)),
            score: ROUND(value),
            maxScore: pidMax,
            accepted: pidMax > 0 && value >= pidMax,
            attempts: journal.length,
            wrongAttempts: journal.filter((entry) => entry.score < pidMax).length,
            firstScore: sorted[0] ? ROUND(sorted[0].score * (pidMax / 100)) : undefined,
        });
    }
    return {
        tid: raw.tdoc.docId.toHexString(),
        title: raw.tdoc.title,
        score: ROUND(score),
        maxScore,
        rank,
        participantCount,
        solved,
        problems,
    };
}

function buildTagStatistics(rawContests: RawAnalysisContest[]): ContestAnalysisTagStat[] {
    const stats = new Map<string, ContestAnalysisTagStat>();
    const studentsByTag = new Map<string, Set<number>>();
    for (const raw of rawContests) {
        const tid = raw.tdoc.docId.toHexString();
        for (const pid of raw.tdoc.pids) {
            const pdoc = raw.pdocs.find((item) => item.docId === pid);
            const maxScore = contestProblemMaxScore(raw.tdoc, pid);
            const tags = (pdoc?.tag || []).map((tag) => String(tag));
            if (!tags.length) continue;
            const attempts = raw.students.filter((student) => student.journal.some((entry) => entry.pid === pid));
            if (!attempts.length) continue;
            const solved = attempts.filter((student) => {
                const score = (student.detail[pid]?.score || 0) * (maxScore / 100);
                return maxScore > 0 && score >= maxScore;
            });
            const solveRate = solved.length / attempts.length;
            const scoreRate = attempts.reduce((sum, student) => {
                const score = (student.detail[pid]?.score || 0) * (maxScore / 100);
                return sum + (maxScore ? (score / maxScore) * 100 : 0);
            }, 0);
            for (const tag of tags) {
                const stat = stats.get(tag) || {
                    tag, problemCount: 0, contestCount: 0, attemptCount: 0, studentCount: 0,
                    solveCount: 0, solveRate: 0, scoreRate: 0, problems: [],
                };
                stat.problemCount++;
                stat.attemptCount += attempts.length;
                stat.solveCount += solved.length;
                stat.scoreRate += scoreRate;
                const studentSet = studentsByTag.get(tag) || new Set<number>();
                for (const student of attempts) studentSet.add(student.uid);
                studentsByTag.set(tag, studentSet);
                stat.problems.push({
                    tid, pid, title: pdoc?.title || `#${pid}`, difficulty: pdoc?.difficulty || 0, solveRate,
                });
                stats.set(tag, stat);
            }
        }
    }
    for (const stat of stats.values()) {
        stat.contestCount = new Set(stat.problems.map((item) => item.tid)).size;
        stat.studentCount = studentsByTag.get(stat.tag)?.size || 0;
        stat.solveRate = stat.attemptCount ? stat.solveCount / stat.attemptCount : 0;
        stat.scoreRate = stat.attemptCount ? stat.scoreRate / stat.attemptCount : 0;
        stat.problems.sort((left, right) => right.difficulty - left.difficulty || left.solveRate - right.solveRate);
    }
    return [...stats.values()].sort((left, right) => left.solveRate - right.solveRate);
}

export function computeContestAnalysisSnapshot(
    rawContests: RawAnalysisContest[], options: AnalysisSnapshotInput = {},
): ContestAnalysisSnapshot {
    const studentFacts = new Map<number, ContestAnalysisStudentFact>();
    const contestFacts = rawContests.map((raw) => {
        const ranked = rankStudents(raw.students);
        const participantCount = raw.students.filter((student) => !student.unrank).length;
        const problems = buildProblemFacts(raw);
        const totalMax = problems.reduce((sum, fact) => sum + fact.maxScore, 0) || 100;
        const scores = ranked.map(([, student]) => student.score);
        const bucketCount = Math.max(1, Math.ceil(totalMax / 50));
        const tagOverlap = new Map<string, number[]>();
        for (const fact of problems) {
            for (const tag of fact.tags) {
                const pids = tagOverlap.get(tag) || [];
                pids.push(fact.pid);
                tagOverlap.set(tag, pids);
            }
        }
        for (const [rank, student] of ranked) {
            const result = buildStudentContestResult(raw, student, rank, participantCount);
            const fact = studentFacts.get(student.uid) || {
                uid: student.uid,
                uname: '',
                displayName: '',
                contests: [],
                totals: {
                    score: 0, maxScore: 0, contestCount: rawContests.length, attendedCount: 0,
                    solvedCount: 0, problemCount: 0, averageScore: 0, medianRank: 0,
                },
                tags: [],
            };
            fact.contests.push(result);
            fact.totals.score += result.score;
            fact.totals.maxScore += result.maxScore;
            fact.totals.solvedCount += result.solved.length;
            fact.totals.problemCount += result.problems.length;
            if (result.problems.some((item) => item.attempts > 0)) fact.totals.attendedCount++;
            studentFacts.set(student.uid, fact);
        }
        return {
            tid: raw.tdoc.docId.toHexString(),
            title: raw.tdoc.title,
            rule: raw.tdoc.rule,
            beginAt: raw.tdoc.beginAt.toISOString(),
            endAt: raw.tdoc.endAt.toISOString(),
            durationMs: Math.max(0, raw.tdoc.endAt.getTime() - raw.tdoc.beginAt.getTime()),
            registeredCount: raw.tdoc.attend || participantCount,
            participantCount,
            problems,
            difficultyGradient: problems.map((item) => item.difficulty),
            tagOverlap: [...tagOverlap.entries()]
                .map(([tag, pids]) => ({ tag, pids }))
                .filter((item) => item.pids.length > 1)
                .sort((left, right) => right.pids.length - left.pids.length),
            scoreStats: {
                count: scores.length,
                mean: scores.length ? ROUND(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
                median: ROUND(median(scores)),
                max: scores.length ? Math.max(...scores) : 0,
                min: scores.length ? Math.min(...scores) : 0,
                buckets: distribution(scores, bucketCount, 50),
            },
        } satisfies ContestAnalysisContestFact;
    });
    const order = new Map(rawContests.map((raw, index) => [raw.tdoc.docId.toHexString(), index] as const));
    for (const fact of studentFacts.values()) {
        fact.contests.sort((left, right) => (order.get(left.tid) || 0) - (order.get(right.tid) || 0));
        fact.totals.averageScore = fact.contests.length
            ? ROUND(fact.contests.reduce((sum, item) => sum + item.score, 0) / fact.contests.length) : 0;
        const ranks = fact.contests.filter((item) => item.rank > 0).map((item) => item.rank);
        fact.totals.medianRank = ROUND(median(ranks));
        const tagMap = new Map<string, { tag: string, attempted: number, solved: number, partial: number, failed: number }>();
        for (const item of fact.contests) {
            for (const result of item.problems) {
                for (const tag of result.tags) {
                    const entry = tagMap.get(tag) || {
                        tag, attempted: 0, solved: 0, partial: 0, failed: 0,
                    };
                    if (result.attempts > 0) {
                        entry.attempted++;
                        if (result.accepted) entry.solved++;
                        else if (result.score > 0) entry.partial++;
                        else entry.failed++;
                    }
                    tagMap.set(tag, entry);
                }
            }
        }
        fact.tags = [...tagMap.values()]
            .filter((entry) => entry.attempted > 0)
            .sort((left, right) => (
                right.failed - left.failed || right.partial - left.partial || left.solved - right.solved
            ));
    }
    return {
        version: CONTEST_ANALYSIS_VERSION,
        generatedAt: new Date().toISOString(),
        title: options.title || '',
        instructions: options.instructions || '',
        contests: contestFacts,
        tags: buildTagStatistics(rawContests),
        students: [...studentFacts.values()],
    };
}

export async function collectContestAnalysisData(domainId: string, tids: ObjectId[]): Promise<RawAnalysisContest[]> {
    if (!tids.length) throw new Error('At least one contest is required.');
    if (tids.length > MAX_ANALYSIS_CONTESTS) {
        throw new Error(`At most ${MAX_ANALYSIS_CONTESTS} contests can be analyzed at once.`);
    }
    const raw: RawAnalysisContest[] = [];
    for (const tid of tids) {
        // eslint-disable-next-line no-await-in-loop
        const tdoc = await contest.get(domainId, tid);
        // eslint-disable-next-line no-await-in-loop
        const pdict = await problem.getList(domainId, tdoc.pids, true, true, problem.PROJECTION_CONTEST_DETAIL);
        const pdocs = tdoc.pids.map((pid) => pdict[pid]).filter(Boolean) as ProblemDoc[];

        const cursor = contest.getMultiStatus(domainId, { docId: tid, attend: { $gt: 0 } })
            .sort({ score: -1 });
        // eslint-disable-next-line no-await-in-loop
        const tsdocs = await cursor.toArray();
        if (tsdocs.length > MAX_ANALYSIS_STUDENTS) {
            throw new Error(`Contest ${tdoc.title} has ${tsdocs.length} participants; at most ${MAX_ANALYSIS_STUDENTS} are supported.`);
        }
        raw.push({
            tdoc,
            pdocs,
            students: tsdocs.map((tsdoc) => ({
                uid: tsdoc.uid as number,
                score: tsdoc.score || 0,
                unrank: tsdoc.unrank,
                journal: tsdoc.journal || [],
                detail: tsdoc.detail || {},
            })),
        });
    }
    return raw;
}

export async function buildContestAnalysisSnapshot(
    domainId: string, tids: ObjectId[], options: AnalysisSnapshotInput = {},
): Promise<ContestAnalysisSnapshot> {
    const raw = await collectContestAnalysisData(domainId, tids);
    const snapshot = computeContestAnalysisSnapshot(raw, options);
    const uids = snapshot.students.map((student) => student.uid);
    const users = await user.getListForRender(domainId, uids, ['realName']);
    for (const student of snapshot.students) {
        const udoc = users[student.uid];
        student.uname = udoc?.uname || String(student.uid);
        student.displayName = udoc?.displayName || student.uname;
        const realName = (udoc as any)?.realName;
        if (typeof realName === 'string' && realName.trim()) student.realName = realName.trim();
    }
    return snapshot;
}
