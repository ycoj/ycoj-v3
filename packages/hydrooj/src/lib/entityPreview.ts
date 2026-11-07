import type { ObjectId } from 'mongodb';

/** Fields read for a problem preview. Statements, testdata, and judge config stay out. */
export const PROBLEM_PREVIEW_FIELDS = [
    'docId', 'pid', 'owner', 'maintainer', 'title',
    'nSubmit', 'nAccept', 'difficulty', 'tag', 'hidden',
] as const;

/** Contest and homework documents share this projection. `content` is intentionally absent. */
export const CONTEST_PREVIEW_FIELDS = [
    'docId', 'title', 'rule', 'beginAt', 'endAt', 'attend', 'pids',
    'owner', 'maintainer', 'assign', 'rated', 'penaltySince',
] as const;

/** Characters sampled from a training summary before whitespace is collapsed. */
export const TRAINING_EXCERPT_SAMPLE = 160;

/** Visible excerpt length after collapsing whitespace. */
export const TRAINING_EXCERPT_LIMIT = 140;

const HEAVY_PREVIEW_FIELDS = [
    'content', 'html', 'data', 'config', 'additional_file', 'reference',
    'description', 'files', 'privateFiles', 'stats',
] as const;

export type ScheduleStatus = 'pending' | 'running' | 'ended';

export type ProblemPreview = {
    kind: 'problem';
    id: string;
    pid: string;
    title: string;
    difficulty: number;
    tags: string[];
    nAccept: number;
    nSubmit: number;
    hidden: boolean;
};

export type ContestPreview = {
    kind: 'contest';
    id: string;
    title: string;
    rule: string;
    status: ScheduleStatus;
    beginAt: string;
    endAt: string;
    attend: number;
    problemCount: number;
    rated: boolean;
};

export type HomeworkPreview = {
    kind: 'homework';
    id: string;
    title: string;
    status: ScheduleStatus;
    deadline: string;
    attend: number;
    problemCount: number;
};

export type TrainingPreview = {
    kind: 'training';
    id: string;
    title: string;
    excerpt: string;
    sectionCount: number;
    problemCount: number;
    attend: number;
    enrolled: boolean;
    progress: number | null;
};

export type EntityPreview = ProblemPreview | ContestPreview | HomeworkPreview | TrainingPreview;

type ProblemSource = {
    docId: number;
    pid?: string;
    title?: string;
    difficulty?: number;
    tag?: unknown;
    nAccept?: number;
    nSubmit?: number;
    hidden?: boolean;
};

type ContestSource = {
    docId: ObjectId | string;
    title?: string;
    rule?: string;
    beginAt?: Date | string;
    endAt?: Date | string;
    penaltySince?: Date | string;
    attend?: number;
    pids?: unknown[];
    rated?: boolean;
};

type TrainingNode = { pids?: unknown[] };

type TrainingSource = {
    docId: ObjectId | string;
    title?: string;
    excerpt?: string;
    attend?: number;
    dag?: TrainingNode[];
};

type TrainingStatusSource = {
    enroll?: number;
    donePids?: number[];
} | null | undefined;

export function scheduleStatus(
    beginAt: Date | string | undefined,
    endAt: Date | string | undefined,
    now = Date.now(),
): ScheduleStatus {
    const begin = beginAt ? new Date(beginAt).getTime() : Number.NaN;
    const end = endAt ? new Date(endAt).getTime() : Number.NaN;
    if (Number.isFinite(begin) && Number.isFinite(end)) {
        if (now < begin) return 'pending';
        if (now < end) return 'running';
    }
    return 'ended';
}

export function toIso(value: Date | string | undefined): string {
    if (!value) return '';
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return '';
    return new Date(time).toISOString();
}

export function clipExcerpt(value: string | undefined, limit = TRAINING_EXCERPT_LIMIT): string {
    const collapsed = (value || '').replace(/\s+/g, ' ').trim();
    if (collapsed.length <= limit) return collapsed;
    return `${collapsed.slice(0, limit).trimEnd()}…`;
}

function docIdString(docId: ObjectId | string): string {
    return typeof docId === 'string' ? docId : docId.toHexString();
}

function count(value: number | undefined): number {
    return Number.isFinite(value) ? Number(value) : 0;
}

function problemTags(tag: unknown): string[] {
    if (!Array.isArray(tag)) return [];
    return tag.filter((item): item is string => typeof item === 'string' && item.length > 0).slice(0, 3);
}

export function trainingProblemIds(dag: TrainingNode[] | undefined): Set<number> {
    const ids = new Set<number>();
    for (const node of dag || []) {
        for (const raw of node?.pids || []) {
            const pid = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
            if (Number.isSafeInteger(pid)) ids.add(pid);
        }
    }
    return ids;
}

export function trainingProgress(problemIds: Set<number>, donePids: number[] | undefined): number {
    if (!problemIds.size) return 100;
    let done = 0;
    for (const pid of donePids || []) {
        if (problemIds.has(+pid)) done += 1;
    }
    return Math.floor((100 * done) / problemIds.size);
}

export function buildProblemPreview(id: string, pdoc: ProblemSource): ProblemPreview {
    return {
        kind: 'problem',
        id,
        pid: pdoc.pid || `P${pdoc.docId}`,
        title: pdoc.title || id,
        difficulty: typeof pdoc.difficulty === 'number' ? pdoc.difficulty : 0,
        tags: problemTags(pdoc.tag),
        nAccept: count(pdoc.nAccept),
        nSubmit: count(pdoc.nSubmit),
        hidden: Boolean(pdoc.hidden),
    };
}

export function buildContestPreview(tdoc: ContestSource, now = Date.now()): ContestPreview {
    return {
        kind: 'contest',
        id: docIdString(tdoc.docId),
        title: tdoc.title || docIdString(tdoc.docId),
        rule: tdoc.rule || '',
        status: scheduleStatus(tdoc.beginAt, tdoc.endAt, now),
        beginAt: toIso(tdoc.beginAt),
        endAt: toIso(tdoc.endAt),
        attend: count(tdoc.attend),
        problemCount: tdoc.pids?.length || 0,
        rated: Boolean(tdoc.rated),
    };
}

export function buildHomeworkPreview(tdoc: ContestSource, now = Date.now()): HomeworkPreview {
    return {
        kind: 'homework',
        id: docIdString(tdoc.docId),
        title: tdoc.title || docIdString(tdoc.docId),
        status: scheduleStatus(tdoc.beginAt, tdoc.endAt, now),
        deadline: toIso(tdoc.penaltySince || tdoc.endAt),
        attend: count(tdoc.attend),
        problemCount: tdoc.pids?.length || 0,
    };
}

export function buildTrainingPreview(tdoc: TrainingSource, tsdoc: TrainingStatusSource): TrainingPreview {
    const problemIds = trainingProblemIds(tdoc.dag);
    const enrolled = Boolean(tsdoc?.enroll);
    return {
        kind: 'training',
        id: docIdString(tdoc.docId),
        title: tdoc.title || docIdString(tdoc.docId),
        excerpt: clipExcerpt(tdoc.excerpt),
        sectionCount: tdoc.dag?.length || 0,
        problemCount: problemIds.size,
        attend: count(tdoc.attend),
        enrolled,
        progress: enrolled ? trainingProgress(problemIds, tsdoc?.donePids) : null,
    };
}

export function previewOmitsHeavyFields(fields: readonly string[]): boolean {
    return HEAVY_PREVIEW_FIELDS.every((field) => !fields.includes(field));
}
