import type {
    ContestAnalysisContestFact, ContestAnalysisProblemFact, ContestAnalysisSnapshot, ContestAnalysisStudentFact,
} from './types';

const MAX_TOOL_TEXT = 16_000;

export interface AnalysisToolContext {
    snapshot: ContestAnalysisSnapshot;
}

function textResult(text: string, details: Record<string, any> = {}) {
    const truncated = text.length > MAX_TOOL_TEXT
        ? `${text.slice(0, MAX_TOOL_TEXT)}\n[Output truncated]`
        : text;
    return { content: [{ type: 'text' as const, text: truncated }], details: { ...details, truncated: text.length > MAX_TOOL_TEXT } };
}

function json(value: any, details: Record<string, any> = {}) {
    return textResult(JSON.stringify(value, null, 1), details);
}

function round(value: number, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function contestSummary(contest: ContestAnalysisContestFact) {
    return {
        tid: contest.tid,
        title: contest.title,
        rule: contest.rule,
        beginAt: contest.beginAt,
        durationHours: round(contest.durationMs / 3_600_000, 2),
        registeredCount: contest.registeredCount,
        participantCount: contest.participantCount,
        problemCount: contest.problems.length,
        difficultyGradient: contest.difficultyGradient,
        scoreStats: contest.scoreStats,
        tagOverlap: contest.tagOverlap.map((item) => ({
            tag: item.tag,
            pids: item.pids,
        })),
    };
}

function problemSummary(problem: ContestAnalysisProblemFact) {
    return {
        pid: problem.pid,
        title: problem.title,
        difficulty: problem.difficulty,
        tags: problem.tags,
        maxScore: problem.maxScore,
        attemptCount: problem.attemptCount,
        acceptCount: problem.acceptCount,
        solveRate: problem.attemptCount ? round((problem.acceptCount / problem.attemptCount) * 100, 1) : 0,
        averageScore: problem.averageScore,
        submissionCount: problem.submissionCount,
    };
}

function studentSummary(student: ContestAnalysisStudentFact) {
    const gapTags = student.tags
        .filter((tag) => tag.solved < tag.attempted)
        .slice(0, 6)
        .map((tag) => `${tag.tag}(失败${tag.failed}/部分${tag.partial}/通过${tag.solved})`);
    return {
        uid: student.uid,
        name: student.displayName || student.uname,
        uname: student.uname,
        realName: student.realName,
        totals: student.totals,
        scores: student.contests.map((item) => ({ tid: item.tid, score: item.score, maxScore: item.maxScore, rank: item.rank })),
        gapTags,
    };
}

function studentDetail(student: ContestAnalysisStudentFact) {
    return {
        uid: student.uid,
        name: student.displayName || student.uname,
        uname: student.uname,
        realName: student.realName,
        totals: student.totals,
        tags: student.tags,
        contests: student.contests.map((item) => ({
            tid: item.tid,
            title: item.title,
            score: item.score,
            maxScore: item.maxScore,
            rank: item.rank,
            participantCount: item.participantCount,
            solved: item.solved,
            problems: item.problems.map((problem) => ({
                pid: problem.pid,
                title: problem.title,
                difficulty: problem.difficulty,
                tags: problem.tags,
                score: problem.score,
                maxScore: problem.maxScore,
                accepted: problem.accepted,
                attempts: problem.attempts,
                wrongAttempts: problem.wrongAttempts,
                firstScore: problem.firstScore,
            })),
        })),
    };
}

export function createContestAnalysisTools(Type: any, context: AnalysisToolContext): any[] {
    const { snapshot } = context;
    const contestById = new Map(snapshot.contests.map((contest) => [contest.tid, contest]));
    const studentById = new Map(snapshot.students.map((student) => [student.uid, student]));

    const readOnly = { executionMode: 'sequential' as const };

    const getScopeOverview = {
        name: 'get_scope_overview',
        label: 'Scope overview',
        description: 'Return the analysis scope: analyzed contests, total problems, total students, and the aggregate statistics of the whole group.',
        parameters: Type.Object({}),
        ...readOnly,
        async execute() {
            const totals = snapshot.students.reduce((acc, student) => {
                acc.score += student.totals.score;
                acc.maxScore += student.totals.maxScore;
                acc.solved += student.totals.solvedCount;
                acc.problems += student.totals.problemCount;
                return acc;
            }, { score: 0, maxScore: 0, solved: 0, problems: 0 });
            return json({
                title: snapshot.title,
                generatedAt: snapshot.generatedAt,
                contests: snapshot.contests.map(contestSummary),
                problemCount: snapshot.contests.reduce((sum, contest) => sum + contest.problems.length, 0),
                studentCount: snapshot.students.length,
                groupStats: {
                    averageScoreRate: totals.problems ? round((totals.score / Math.max(1, totals.maxScore)) * 100, 1) : 0,
                    solvedProblems: totals.solved,
                    attemptedProblems: totals.problems,
                    scoreBuckets: snapshot.contests.map((contest) => ({
                        tid: contest.tid,
                        totalMax: contest.problems.reduce((sum, problem) => sum + problem.maxScore, 0),
                        buckets: contest.scoreStats.buckets,
                    })),
                },
            }, { tool: 'get_scope_overview' });
        },
    };

    const listContests = {
        name: 'list_contests',
        label: 'List contests',
        description: 'Return every analyzed contest with its schedule, participation, difficulty gradient, score statistics and repeated tags.',
        parameters: Type.Object({}),
        ...readOnly,
        async execute() {
            return json(snapshot.contests.map(contestSummary), { tool: 'list_contests' });
        },
    };

    const getContest = {
        name: 'get_contest',
        label: 'Get contest',
        description: 'Return one analyzed contest with its per-problem statistics: difficulty, tags, '
            + 'attempts, full-score count and average score.',
        parameters: Type.Object({ tid: Type.String({ description: 'Contest id from the analysis scope' }) }),
        ...readOnly,
        async execute(_toolCallId: string, params: { tid: string }) {
            const contest = contestById.get(params.tid);
            if (!contest) {
                const available = snapshot.contests.map((item) => item.tid).join(', ');
                throw new Error(`Contest ${params.tid} is not part of this analysis. Available: ${available}`);
            }
            return json({
                ...contestSummary(contest),
                problems: contest.problems.map(problemSummary),
            }, { tool: 'get_contest', tid: params.tid });
        },
    };

    const listProblems = {
        name: 'list_problems',
        label: 'List problems',
        description: 'List problems across the analyzed contests. Optionally filter by contest id, algorithm tag, or difficulty range.',
        parameters: Type.Object({
            tid: Type.Optional(Type.String()),
            tag: Type.Optional(Type.String({ description: 'Exact algorithm tag' })),
            minDifficulty: Type.Optional(Type.Integer()),
            maxDifficulty: Type.Optional(Type.Integer()),
        }),
        ...readOnly,
        async execute(_toolCallId: string, params: { tid?: string, tag?: string, minDifficulty?: number, maxDifficulty?: number }) {
            const rows = snapshot.contests.flatMap((contest) => contest.problems.map((problem) => ({
                tid: contest.tid,
                contestTitle: contest.title,
                ...problemSummary(problem),
            }))).filter((row) => (
                (!params.tid || row.tid === params.tid)
                && (!params.tag || row.tags.includes(params.tag))
                && (params.minDifficulty === undefined || row.difficulty >= params.minDifficulty)
                && (params.maxDifficulty === undefined || row.difficulty <= params.maxDifficulty)
            ));
            return json({ count: rows.length, problems: rows }, { tool: 'list_problems', count: rows.length });
        },
    };

    const getTagStatistics = {
        name: 'get_tag_statistics',
        label: 'Get tag statistics',
        description: 'Return per-algorithm-tag statistics across the whole scope: how often students '
            + 'attempted problems of that tag and how often they fully solved them. Weakest solve rate first.',
        parameters: Type.Object({
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 60 })),
        }),
        ...readOnly,
        async execute(_toolCallId: string, params: { limit?: number }) {
            const rows = snapshot.tags.slice(0, params.limit || 30).map((tag) => ({
                tag: tag.tag,
                problemCount: tag.problemCount,
                contestCount: tag.contestCount,
                attempts: tag.attemptCount,
                students: tag.studentCount,
                solved: tag.solveCount,
                solveRate: round(tag.solveRate * 100, 1),
                averageScoreRate: round(tag.scoreRate, 1),
                hardestProblems: tag.problems.slice(0, 5).map((problem) => ({
                    tid: problem.tid,
                    pid: problem.pid,
                    title: problem.title,
                    difficulty: problem.difficulty,
                    solveRate: round(problem.solveRate * 100, 1),
                })),
            }));
            return json({ tags: rows }, { tool: 'get_tag_statistics', count: rows.length });
        },
    };

    const listStudents = {
        name: 'list_students',
        label: 'List students',
        description: 'List analyzed students with their per-contest scores, ranks and gap tags. Use offset and limit to page through a large class.',
        parameters: Type.Object({
            offset: Type.Optional(Type.Integer({ minimum: 0 })),
            limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
            sort: Type.Optional(Type.String({
                description: 'average (default) or score to sort descending; rank for the average rank',
            })),
        }),
        ...readOnly,
        async execute(_toolCallId: string, params: { offset?: number, limit?: number, sort?: string }) {
            const students = [...snapshot.students];
            if (params.sort === 'rank') {
                students.sort((left, right) => (left.totals.medianRank || 9999) - (right.totals.medianRank || 9999));
            } else if (params.sort === 'average' || !params.sort) {
                students.sort((left, right) => right.totals.averageScore - left.totals.averageScore);
            } else {
                students.sort((left, right) => right.totals.score - left.totals.score);
            }
            const offset = Math.max(0, params.offset || 0);
            const limit = Math.min(100, Math.max(1, params.limit || 30));
            return json({
                total: students.length,
                offset,
                students: students.slice(offset, offset + limit).map(studentSummary),
            }, { tool: 'list_students', total: students.length });
        },
    };

    const getStudent = {
        name: 'get_student',
        label: 'Get student',
        description: 'Return one student\'s full record: per-contest scores and ranks, per-problem '
            + 'results with attempts, and per-tag solve/fail counts.',
        parameters: Type.Object({ uid: Type.Integer({ description: 'Student uid' }) }),
        ...readOnly,
        async execute(_toolCallId: string, params: { uid: number }) {
            const student = studentById.get(params.uid);
            if (!student) throw new Error(`Student ${params.uid} is not part of this analysis.`);
            return json(studentDetail(student), { tool: 'get_student', uid: params.uid });
        },
    };

    const searchStudents = {
        name: 'search_students',
        label: 'Search students',
        description: 'Find students by username, display name or real name substring.',
        parameters: Type.Object({ query: Type.String({ minLength: 1 }) }),
        ...readOnly,
        async execute(_toolCallId: string, params: { query: string }) {
            const query = params.query.trim().toLowerCase();
            const rows = snapshot.students.filter((student) => (
                student.uname.toLowerCase().includes(query)
                || student.displayName.toLowerCase().includes(query)
                || (student.realName || '').toLowerCase().includes(query)
                || String(student.uid) === query
            ));
            return json(rows.slice(0, 20).map(studentSummary), { tool: 'search_students', count: rows.length });
        },
    };

    return [
        getScopeOverview, listContests, getContest, listProblems, getTagStatistics,
        listStudents, getStudent, searchStudents,
    ];
}

export interface AnalysisSubmission {
    overview?: any;
    contests?: any;
    students?: any;
}

export function createOverviewSubmissionTool(Type: any, submissions: AnalysisSubmission[]) {
    return {
        name: 'submit_overall_analysis',
        label: 'Submit overall analysis',
        description: 'Submit the overall analysis of the whole group and the per-contest review. '
            + 'Call exactly once, after all data has been inspected.',
        parameters: Type.Object({
            overview: Type.Object({
                summary: Type.String({ description: 'Markdown narrative of the whole group, 2-5 paragraphs' }),
                keywords: Type.Array(Type.String({ description: 'Short conclusion keywords' })),
                weakPoints: Type.Array(Type.Object({
                    tag: Type.String({ description: 'Weak knowledge point (algorithm tag)' }),
                    severity: Type.String({ description: 'high, medium or low' }),
                    summary: Type.String(),
                    evidence: Type.String({ description: 'Concrete numbers from the data' }),
                    contests: Type.Array(Type.String({ description: 'Contest titles the evidence comes from' })),
                    advice: Type.String({ description: 'Training advice for this knowledge point' }),
                })),
                difficultyComment: Type.String(),
                balanceComment: Type.String(),
                highlights: Type.Array(Type.String()),
                recommendations: Type.Array(Type.String()),
            }),
            contests: Type.Array(Type.Object({
                tid: Type.String({ description: 'Contest id in the analysis scope' }),
                summary: Type.String(),
                difficultyComment: Type.String(),
                balanceComment: Type.String(),
                problemComments: Type.Array(Type.Object({
                    pid: Type.Integer(),
                    comment: Type.String({ description: 'Short review of the problem knowledge points and results' }),
                })),
            })),
        }),
        executionMode: 'sequential' as const,
        async execute(_toolCallId: string, params: any) {
            if (submissions.length) throw new Error('The overall analysis was already submitted.');
            submissions.push({ overview: params.overview, contests: params.contests });
            return textResult('Overall analysis received.', { submitted: true });
        },
    };
}

export function createStudentSubmissionTool(Type: any, expected: number[], submissions: AnalysisSubmission[]) {
    return {
        name: 'submit_student_reports',
        label: 'Submit student reports',
        description: 'Submit the individual reports for every student in the current batch. Call exactly once with one entry per uid.',
        parameters: Type.Object({
            students: Type.Array(Type.Object({
                uid: Type.Integer(),
                level: Type.String({ description: 'excellent, good, average, weak or at_risk' }),
                summary: Type.String({ description: 'Per-student narrative' }),
                strengths: Type.Array(Type.String()),
                weaknesses: Type.Array(Type.String()),
                recurringIssues: Type.Array(Type.Object({
                    issue: Type.String(),
                    evidence: Type.String({ description: "Concrete numbers from this student's records" }),
                    advice: Type.String(),
                })),
                focusTags: Type.Array(Type.String({ description: 'Algorithm tags this student should train next' })),
                contestComments: Type.Array(Type.Object({
                    tid: Type.String(),
                    comment: Type.String(),
                })),
                actionPlan: Type.Array(Type.String({ description: 'Concrete next steps' })),
            })),
        }),
        executionMode: 'sequential' as const,
        async execute(_toolCallId: string, params: any) {
            if (submissions.length) throw new Error('The student reports were already submitted.');
            const uids = (params.students || []).map((item: any) => Number(item?.uid));
            const missing = expected.filter((uid) => !uids.includes(uid));
            if (missing.length) throw new Error(`Missing students in this batch: ${missing.join(', ')}. Submit all of them in one call.`);
            submissions.push({ students: params.students });
            return textResult('Student reports received.', { submitted: true, count: uids.length });
        },
    };
}
