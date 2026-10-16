import {
    CONTEST_ANALYSIS_VERSION, type ContestAnalysisContestReport, type ContestAnalysisOverviewReport,
    type ContestAnalysisReport, type ContestAnalysisSnapshot, type ContestAnalysisStudentReport,
} from './types';

export class ContestAnalysisReportError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ContestAnalysisReportError';
    }
}

export interface AnalysisScopeIndex {
    tids: Set<string>;
    contestTitles: Map<string, string>;
    problemTitles: Map<string, Map<number, string>>;
    studentNames: Map<number, string>;
    students: number[];
}

export function createScopeIndex(snapshot: ContestAnalysisSnapshot): AnalysisScopeIndex {
    const problemTitles = new Map<string, Map<number, string>>();
    for (const contest of snapshot.contests) {
        problemTitles.set(contest.tid, new Map(contest.problems.map((item) => [item.pid, item.title])));
    }
    return {
        tids: new Set(snapshot.contests.map((contest) => contest.tid)),
        contestTitles: new Map(snapshot.contests.map((contest) => [contest.tid, contest.title])),
        problemTitles,
        studentNames: new Map(snapshot.students.map((student) => [student.uid, student.displayName || student.uname])),
        students: snapshot.students.map((student) => student.uid),
    };
}

function text(value: any, field: string, maxLength = 800, required = false) {
    if (typeof value !== 'string') {
        if (required) throw new ContestAnalysisReportError(`${field} must be a non-empty string.`);
        return '';
    }
    const normalized = value.replace(/\r\n/g, '\n').trim();
    if (required && !normalized) throw new ContestAnalysisReportError(`${field} must be a non-empty string.`);
    if (normalized.length > maxLength) return `${normalized.slice(0, maxLength)}…`;
    return normalized;
}

function textList(value: any, field: string, maxItems = 12, itemLength = 400) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new ContestAnalysisReportError(`${field} must be an array of strings.`);
    return value
        .slice(0, maxItems)
        .map((item, index) => text(item, `${field}[${index}]`, itemLength))
        .filter((item) => !!item);
}

const SEVERITIES = new Set(['high', 'medium', 'low']);
const LEVELS = new Set(['excellent', 'good', 'average', 'weak', 'at_risk']);

export function normalizeOverviewReport(value: any, scope: AnalysisScopeIndex): ContestAnalysisOverviewReport {
    if (!value || typeof value !== 'object') throw new ContestAnalysisReportError('overview must be an object.');
    const weakPoints = Array.isArray(value.weakPoints) ? value.weakPoints : [];
    return {
        summary: text(value.summary, 'overview.summary', 4000, true),
        keywords: textList(value.keywords, 'overview.keywords', 10, 40),
        weakPoints: weakPoints.slice(0, 10).map((item: any, index: number) => {
            if (!item || typeof item !== 'object') {
                throw new ContestAnalysisReportError(`overview.weakPoints[${index}] must be an object.`);
            }
            const tag = text(item.tag, `overview.weakPoints[${index}].tag`, 80, true);
            const severity = SEVERITIES.has(item.severity) ? item.severity : 'medium';
            const contests = Array.isArray(item.contests)
                ? item.contests.slice(0, 12)
                    .map((tid: any) => String(tid || '').trim())
                    .map((tid: string) => scope.contestTitles.get(tid) || tid)
                    .filter(Boolean)
                : [];
            return {
                tag,
                severity,
                summary: text(item.summary, `overview.weakPoints[${index}].summary`, 600, true),
                evidence: text(item.evidence, `overview.weakPoints[${index}].evidence`, 800, true),
                contests,
                advice: text(item.advice, `overview.weakPoints[${index}].advice`, 600, true),
            };
        }),
        difficultyComment: text(value.difficultyComment, 'overview.difficultyComment', 2000, true),
        balanceComment: text(value.balanceComment, 'overview.balanceComment', 2000, true),
        highlights: textList(value.highlights, 'overview.highlights', 8, 400),
        recommendations: textList(value.recommendations, 'overview.recommendations', 8, 600),
    };
}

export function normalizeContestReports(value: any, scope: AnalysisScopeIndex): ContestAnalysisContestReport[] {
    if (!Array.isArray(value)) throw new ContestAnalysisReportError('contests must be an array.');
    const seen = new Set<string>();
    const reports: ContestAnalysisContestReport[] = [];
    for (const [index, item] of value.entries()) {
        if (!item || typeof item !== 'object') {
            throw new ContestAnalysisReportError(`contests[${index}] must be an object.`);
        }
        const tid = String(item.tid || '');
        if (!scope.tids.has(tid)) {
            throw new ContestAnalysisReportError(`contests[${index}].tid "${tid}" is not part of the analyzed contests.`);
        }
        if (seen.has(tid)) throw new ContestAnalysisReportError(`contest ${tid} was reported twice.`);
        seen.add(tid);
        const known = scope.problemTitles.get(tid) || new Map<number, string>();
        const problemComments = Array.isArray(item.problemComments) ? item.problemComments.slice(0, 30) : [];
        reports.push({
            tid,
            summary: text(item.summary, `contests[${index}].summary`, 2000, true),
            difficultyComment: text(item.difficultyComment, `contests[${index}].difficultyComment`, 1200, false),
            balanceComment: text(item.balanceComment, `contests[${index}].balanceComment`, 1200, false),
            problemComments: problemComments.map((entry: any, entryIndex: number) => {
                const pid = Number(entry?.pid);
                if (!Number.isSafeInteger(pid) || !known.has(pid)) {
                    throw new ContestAnalysisReportError(
                        `contests[${index}].problemComments[${entryIndex}].pid "${entry?.pid}" is not part of this contest.`,
                    );
                }
                return {
                    pid,
                    comment: text(entry?.comment, `contests[${index}].problemComments[${entryIndex}].comment`, 800, true),
                };
            }),
        });
    }
    for (const tid of scope.tids) {
        if (!seen.has(tid)) {
            throw new ContestAnalysisReportError(`Missing report for contest ${scope.contestTitles.get(tid) || tid}.`);
        }
    }
    return reports.sort((left, right) => (
        [...scope.tids].indexOf(left.tid) - [...scope.tids].indexOf(right.tid)
    ));
}

export function normalizeStudentReports(
    value: any, scope: AnalysisScopeIndex, expected: number[],
): ContestAnalysisStudentReport[] {
    if (!Array.isArray(value)) throw new ContestAnalysisReportError('students must be an array.');
    const expectedSet = new Set(expected);
    const seen = new Set<number>();
    const reports: ContestAnalysisStudentReport[] = [];
    for (const [index, item] of value.entries()) {
        if (!item || typeof item !== 'object') {
            throw new ContestAnalysisReportError(`students[${index}] must be an object.`);
        }
        const uid = Number(item.uid);
        if (!Number.isSafeInteger(uid) || !expectedSet.has(uid)) {
            throw new ContestAnalysisReportError(
                `students[${index}].uid "${item?.uid}" is not part of this batch (${expected.join(', ')}).`,
            );
        }
        if (seen.has(uid)) throw new ContestAnalysisReportError(`student ${uid} was reported twice.`);
        seen.add(uid);
        const recurringIssues = Array.isArray(item.recurringIssues) ? item.recurringIssues.slice(0, 8) : [];
        const contestComments = Array.isArray(item.contestComments) ? item.contestComments.slice(0, 12) : [];
        reports.push({
            uid,
            level: LEVELS.has(item.level) ? item.level : 'average',
            summary: text(item.summary, `students[${index}].summary`, 2000, true),
            strengths: textList(item.strengths, `students[${index}].strengths`, 6, 400),
            weaknesses: textList(item.weaknesses, `students[${index}].weaknesses`, 6, 400),
            recurringIssues: recurringIssues.map((entry: any, entryIndex: number) => ({
                issue: text(entry?.issue, `students[${index}].recurringIssues[${entryIndex}].issue`, 400, true),
                evidence: text(entry?.evidence, `students[${index}].recurringIssues[${entryIndex}].evidence`, 600, true),
                advice: text(entry?.advice, `students[${index}].recurringIssues[${entryIndex}].advice`, 400, true),
            })),
            focusTags: textList(item.focusTags, `students[${index}].focusTags`, 8, 60),
            contestComments: contestComments.map((entry: any, entryIndex: number) => {
                const tid = String(entry?.tid || '');
                if (!scope.tids.has(tid)) {
                    throw new ContestAnalysisReportError(
                        `students[${index}].contestComments[${entryIndex}].tid "${entry?.tid}" is not part of the analysis.`,
                    );
                }
                return {
                    tid,
                    comment: text(entry?.comment, `students[${index}].contestComments[${entryIndex}].comment`, 600, true),
                };
            }),
            actionPlan: textList(item.actionPlan, `students[${index}].actionPlan`, 6, 400),
        });
    }
    for (const uid of expected) {
        if (!seen.has(uid)) {
            throw new ContestAnalysisReportError(
                `Missing report for student ${scope.studentNames.get(uid) || uid} (uid ${uid}).`,
            );
        }
    }
    return reports.sort((left, right) => expected.indexOf(left.uid) - expected.indexOf(right.uid));
}

export function normalizeAnalysisReport(
    input: { overview?: any, contests?: any, students?: any },
    scope: AnalysisScopeIndex, expectedStudents: number[],
): ContestAnalysisReport {
    return {
        version: CONTEST_ANALYSIS_VERSION,
        overview: normalizeOverviewReport(input.overview, scope),
        contests: normalizeContestReports(input.contests, scope),
        students: normalizeStudentReports(input.students, scope, expectedStudents),
    };
}
