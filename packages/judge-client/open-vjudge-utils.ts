import { LangConfig, STATUS } from '@hydrooj/common';
import { yaml } from 'hydrooj';

export const OPEN_VJUDGE_PROVIDER = 'open-vjudge';

export type OpenVJudgeJudge = 'atcoder' | 'codeforces';

export interface OpenVJudgeSubmissionTarget {
    judge: OpenVJudgeJudge;
    problem?: string;
    contest?: string;
    task?: string;
}

export interface OpenVJudgeTestResult {
    index?: number | null;
    name?: string | null;
    verdict?: string | null;
    raw?: string | null;
    timeMs?: number | null;
    memoryKb?: number | null;
    score?: number | null;
    message?: string | null;
}

export interface OpenVJudgeResult {
    state?: string;
    verdict?: string;
    raw?: string | null;
    score?: number | null;
    timeMs?: number | null;
    memoryKb?: number | null;
    compileMessage?: string | null;
    tests?: OpenVJudgeTestResult[] | null;
    error?: { message?: string } | null;
}

export function isOpenVJudgePid(pid: string) {
    return /^(?:CF|abc|arc|agc)/.test(pid || '');
}

export function parseOpenVJudgeProblem(pid: string): OpenVJudgeSubmissionTarget {
    const source = (pid || '').trim();
    const codeforces = /^CF[-_:/]?(\d+[A-Z][A-Z0-9]*)$/i.exec(source);
    if (codeforces) return { judge: 'codeforces', problem: codeforces[1].toUpperCase() };
    const atcoder = /^(abc|arc|agc)[-_:/]?(\d{3})[-_:/]?([a-z])$/i.exec(source);
    if (atcoder) {
        const contest = `${atcoder[1].toLowerCase()}${atcoder[2]}`;
        return { judge: 'atcoder', contest, task: `${contest}_${atcoder[3].toLowerCase()}` };
    }
    throw new Error(`Unsupported OpenVJudge problem ID: ${source}`);
}

export function openVJudgeStatus(verdict: string): STATUS {
    switch (verdict) {
        case 'accepted': return STATUS.STATUS_ACCEPTED;
        case 'wrong_answer':
        case 'presentation_error':
        case 'partial': return STATUS.STATUS_WRONG_ANSWER;
        case 'time_limit_exceeded':
        case 'idleness_limit_exceeded': return STATUS.STATUS_TIME_LIMIT_EXCEEDED;
        case 'memory_limit_exceeded': return STATUS.STATUS_MEMORY_LIMIT_EXCEEDED;
        case 'output_limit_exceeded': return STATUS.STATUS_OUTPUT_LIMIT_EXCEEDED;
        case 'runtime_error':
        case 'security_violated':
        case 'crashed': return STATUS.STATUS_RUNTIME_ERROR;
        case 'compilation_error': return STATUS.STATUS_COMPILE_ERROR;
        case 'skipped': return STATUS.STATUS_CANCELED;
        case 'judging': return STATUS.STATUS_JUDGING;
        default: return STATUS.STATUS_SYSTEM_ERROR;
    }
}

export function mapOpenVJudgeResult(result: OpenVJudgeResult) {
    const status = openVJudgeStatus(result.verdict || 'unknown');
    const cases = (result.tests || []).map((test, index) => {
        const testStatus = openVJudgeStatus(test.verdict || 'unknown');
        return {
            id: test.index ?? index + 1,
            subtaskId: 1,
            status: testStatus,
            time: test.timeMs ?? 0,
            memory: test.memoryKb ?? 0,
            message: test.message || test.raw || test.name || '',
            score: test.score ?? (testStatus === STATUS.STATUS_ACCEPTED ? 100 : 0),
        };
    });
    return {
        status,
        score: result.score ?? (status === STATUS.STATUS_ACCEPTED ? 100 : 0),
        time: result.timeMs ?? 0,
        memory: result.memoryKb ?? 0,
        ...(result.compileMessage ? { compilerText: result.compileMessage } : {}),
        ...(result.raw ? { message: result.raw } : {}),
        ...(cases.length ? { cases } : {}),
    };
}

const defaultLanguageKeys = new Set([
    'c', 'cc', 'cc.cc11', 'cc.cc11o2', 'cc.cc14', 'cc.cc14o2', 'cc.cc17', 'cc.cc17o2', 'cc.cc20', 'cc.cc20o2',
    'java', 'kt', 'kt.jvm', 'py', 'py.py3', 'py.pypy3', 'php', 'rs', 'hs', 'js', 'go', 'rb', 'cs', 'pas', 'r',
]);

export function addOpenVJudgeLanguageMappings(source: string) {
    if (!source) return source;
    const config = yaml.load(source) as Record<string, any>;
    if (!config || typeof config !== 'object' || Array.isArray(config)) return source;
    let changed = false;
    for (const [key, lang] of Object.entries(config)) {
        if (!lang || typeof lang !== 'object' || Array.isArray(lang)) continue;
        if (lang.validAs?.[OPEN_VJUDGE_PROVIDER]) continue;
        const inherited = lang.validAs?.judgeclient || lang.validAs?.codeforces;
        const target = inherited
            || (key.startsWith('judgeclient.') || key.startsWith('codeforces.') || defaultLanguageKeys.has(key) ? key : '');
        if (!target) continue;
        lang.validAs ||= {};
        lang.validAs[OPEN_VJUDGE_PROVIDER] = target;
        changed = true;
    }
    return changed ? yaml.dump(config) : source;
}

function languageFromDisplay(key: string, config: LangConfig | undefined, judge: OpenVJudgeJudge) {
    const display = config?.display || key;
    if (key === 'c' || /^C\d*$/i.test(display)) {
        const version = /^C(\d+)$/i.exec(display)?.[1] || '11';
        return [
            judge === 'codeforces' ? `/GNU C${version}\\b/i` : `/C${version}\\b/i`,
            '/(?:^|\\s)C(?:\\d|\\s|$)/i',
        ];
    }
    if (key === 'cc' || key.startsWith('cc.') || /C\+\+/i.test(display)) {
        const version = /C\+\+\s*(\d{2})/i.exec(display)?.[1]
            || /^cc\.cc(\d{2})/.exec(key)?.[1] || (key === 'cc' ? '14' : '');
        const generic = '/[CG]\\+\\+/i';
        if (!version) return generic;
        return [
            judge === 'codeforces' ? `/GNU [CG]\\+\\+${version}\\b/i` : `/C\\+\\+\\s*${version}\\b/i`,
            generic,
        ];
    }
    if (key === 'py.pypy3' || /pypy/i.test(display)) return ['/PyPy.*3/i', '/PyPy/i'];
    if (key === 'py' || key === 'py.py3' || /^Python/i.test(display)) return ['/Python.*3/i', '/Python/i'];
    if (key === 'js') return judge === 'codeforces' ? '/JavaScript/i' : '/Node\\.js/i';
    if (key === 'go') return '/^Go(?:\\s|$)/i';
    if (key === 'r') return '/^R(?:\\s|$)/i';
    return display.replace(/\s*\(O2\)\s*$/i, '');
}

export function resolveOpenVJudgeLanguage(
    language: string,
    judge: OpenVJudgeJudge,
    langs: Record<string, LangConfig>,
): string | string[] {
    const value = String(language || '').trim();
    if (!value) return value;
    if (value.startsWith('open-vjudge.')) return value.slice('open-vjudge.'.length);
    if (judge === 'codeforces' && value.startsWith('codeforces.')) return value.slice('codeforces.'.length);
    if (/^\d+$/.test(value) || value.startsWith('/')) return value;

    const direct = langs[value];
    if (direct) return languageFromDisplay(value, direct, judge);
    const candidates = Object.entries(langs).filter(([, config]) => [
        config.validAs?.[OPEN_VJUDGE_PROVIDER], config.validAs?.judgeclient, config.validAs?.codeforces,
    ].includes(value));
    candidates.sort(([a, configA], [b, configB]) => {
        const remoteA = a.startsWith('judgeclient.') || a.startsWith('codeforces.') || configA.hidden;
        const remoteB = b.startsWith('judgeclient.') || b.startsWith('codeforces.') || configB.hidden;
        return Number(remoteA) - Number(remoteB) || a.localeCompare(b);
    });
    if (candidates.length) return languageFromDisplay(candidates[0][0], candidates[0][1], judge);
    if (value.startsWith('judgeclient.') || value.startsWith('codeforces.')) {
        throw new Error(`Cannot resolve legacy language: ${value}`);
    }
    return value;
}
