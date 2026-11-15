import assert from 'node:assert/strict';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { describe, it } from 'node:test';

const { STATUS } = require('@hydrooj/common');
const SettingModel = { langs: {} };
const hydroMock = {
    STATUS,
    SettingModel,
    SystemModel: { get: () => undefined },
    DocumentModel: {
        TYPE_PROBLEM: 10,
        coll: { find: () => { throw new Error('Unexpected problem query.'); } },
    },
    ProblemModel: { addTestdata: async () => { } },
    Logger: class {
        info() { }
        error() { }
    },
    sleep: async () => { },
    yaml: require('js-yaml'),
};
require.cache[require.resolve('hydrooj')] = { exports: hydroMock } as NodeJS.Module;
const { yaml } = hydroMock;
const OpenVJudgeProvider = require('./open-vjudge').default;
const {
    addOpenVJudgeLanguageMappings, isOpenVJudgePid, mapOpenVJudgeResult, parseOpenVJudgeProblem, resolveOpenVJudgeLanguage,
} = require('./open-vjudge-utils');
const { migrateOpenVJudgeProblems, migrateYbtOpenVJudgeProblems } = require('./migration');

function remoteProblem(pid: string, extra: Record<string, any> = {}): any {
    return {
        domainId: 'system',
        docId: 1,
        pid,
        config: 'type: remote_judge\nsubType: judgeclient\ntarget: old\ntime: 2s\n',
        data: [{ name: 'config.yaml' }],
        ...extra,
    };
}

describe('OpenVJudge migration', () => {
    it('migrates only remote problems without local testdata and is idempotent', async () => {
        const docs = [
            remoteProblem('CF4A'),
            remoteProblem('abc001a', { docId: 2, config: 'type: remote_judge\nsubType: codeforces\ntarget: abc001a\nlangs: [cc.cc17]\n' }),
            remoteProblem('arc001a', { docId: 3, data: [{ name: 'config.yaml' }, { name: '1.in' }] }),
            remoteProblem('agc001a', { docId: 4, config: 'type: default\n' }),
            remoteProblem('CF5B', { docId: 5, reference: { domainId: 'system', pid: 1 } }),
            remoteProblem('P1000', { docId: 6 }),
            remoteProblem('CF6A', { docId: 7, config: 'type: remote_judge\nsubType: open-vjudge\ntarget: CF6A\n' }),
            remoteProblem('CF7A', { docId: 8, data: [{ name: 'config.yml' }] }),
            remoteProblem('cf8A', { docId: 9 }),
            remoteProblem('YBT1001', { docId: 10 }),
            remoteProblem('YBT1002', { docId: 11, data: [{ name: 'config.yaml' }, { name: '1.out' }] }),
            remoteProblem('YBT1003', { docId: 12, config: 'type: default\n' }),
            remoteProblem('YBT1004', { docId: 13, reference: { domainId: 'system', pid: 10 } }),
            remoteProblem('YBT1005', { docId: 14, config: 'type: remote_judge\nsubType: open-vjudge\ntarget: YBT1005\n' }),
            remoteProblem('YBTBAS501', { docId: 15 }),
            remoteProblem('YBT1001A', { docId: 16 }),
        ];
        const saved: Array<{ domainId: string, docId: number, config: string }> = [];
        const store = {
            async *findProblems() { yield* docs; },
            async saveConfig(domainId: string, docId: number, config: string) {
                saved.push({ domainId, docId, config });
                docs.find((doc) => doc.docId === docId).config = config;
            },
        };
        assert.equal(await migrateOpenVJudgeProblems(store), true);
        assert.deepEqual(saved.map((item) => item.docId), [1, 2, 8, 10]);
        for (const item of saved) {
            const config = yaml.load(item.config);
            assert.equal(config.type, 'remote_judge');
            assert.equal(config.subType, 'open-vjudge');
            assert.equal(config.target, docs.find((doc) => doc.docId === item.docId).pid);
        }
        assert.equal(yaml.load(saved[0].config).time, '2s');
        assert.deepEqual(yaml.load(saved[1].config).langs, ['cc.cc17']);
        saved.length = 0;
        await migrateOpenVJudgeProblems(store);
        assert.equal(saved.length, 0);
    });

    it('queries only YBT on upgrade and includes YBT in the initial migration', async (t) => {
        const docs = [
            remoteProblem('CF4A'),
            remoteProblem('YBT1001', { docId: 2 }),
            remoteProblem('YBTBAS501', { docId: 3 }),
            remoteProblem('YBT1001A', { docId: 4 }),
        ];
        const queries: any[] = [];
        const saved: number[] = [];
        t.mock.method(hydroMock.DocumentModel.coll, 'find', (query) => {
            queries.push(query);
            return {
                async *project() {
                    yield* docs.filter((doc) => query.pid.$regex.test(doc.pid));
                },
            };
        });
        t.mock.method(hydroMock.ProblemModel, 'addTestdata', async (domainId, docId, name, content) => {
            assert.equal(domainId, 'system');
            assert.equal(name, 'config.yaml');
            assert.ok(Buffer.isBuffer(content));
            saved.push(docId);
            docs.find((doc) => doc.docId === docId).config = content.toString();
        });

        assert.equal(await migrateYbtOpenVJudgeProblems(), true);
        assert.deepEqual(saved, [2]);
        assert.equal(queries[0].docType, hydroMock.DocumentModel.TYPE_PROBLEM);
        assert.equal(queries[0].pid.$regex.test('CF4A'), false);
        assert.equal(yaml.load(docs[1].config).target, 'YBT1001');
        await migrateYbtOpenVJudgeProblems();
        assert.deepEqual(saved, [2]);

        docs[1].config = remoteProblem('YBT1001').config;
        saved.length = 0;
        assert.equal(await migrateOpenVJudgeProblems(), true);
        assert.deepEqual(saved, [1, 2]);
    });
});

describe('OpenVJudge protocol conversion', () => {
    it('parses Codeforces and AtCoder PID variants', () => {
        assert.deepEqual(parseOpenVJudgeProblem('CF1234A1'), { judge: 'codeforces', problem: '1234A1' });
        assert.deepEqual(parseOpenVJudgeProblem('CF-1234a'), { judge: 'codeforces', problem: '1234A' });
        assert.deepEqual(parseOpenVJudgeProblem('abc097c'), {
            judge: 'atcoder', contest: 'abc097', task: 'abc097_c',
        });
        assert.deepEqual(parseOpenVJudgeProblem('arc-123_d'), {
            judge: 'atcoder', contest: 'arc123', task: 'arc123_d',
        });
        assert.deepEqual(parseOpenVJudgeProblem('agc123f'), {
            judge: 'atcoder', contest: 'agc123', task: 'agc123_f',
        });
        assert.throws(() => parseOpenVJudgeProblem('P1000'), /Unsupported/);
    });

    it('parses numeric YBT PIDs and keeps other YBT variants on the legacy provider', () => {
        assert.equal(isOpenVJudgePid('YBT1001'), true);
        assert.deepEqual(parseOpenVJudgeProblem('YBT1001'), { judge: 'ybt', problem: '1001' });
        assert.deepEqual(parseOpenVJudgeProblem(' ybt100001 '), { judge: 'ybt', problem: '100001' });
        for (const pid of ['YBT', 'YBTBAS501', 'YBT1001A', 'YBT1000000']) {
            assert.equal(isOpenVJudgePid(pid), false);
            assert.throws(() => parseOpenVJudgeProblem(pid), /Unsupported/);
        }
    });

    it('maps verdicts to this repository\'s status values and preserves testcases', () => {
        const mapped = mapOpenVJudgeResult({
            state: 'final',
            verdict: 'wrong_answer',
            timeMs: 21,
            memoryKb: 4096,
            tests: [
                { index: 1, verdict: 'accepted', timeMs: 10, memoryKb: 2048 },
                { index: 2, verdict: 'wrong_answer', raw: 'WA', timeMs: 11, memoryKb: 4096 },
            ],
        });
        assert.equal(mapped.status, STATUS.STATUS_WRONG_ANSWER);
        assert.equal(mapped.status, 2);
        assert.equal(mapped.score, 0);
        assert.equal(mapped.time, 21);
        assert.equal(mapped.memory, 4096);
        assert.equal(mapped.cases[0].status, STATUS.STATUS_ACCEPTED);
        assert.equal(mapped.cases[0].status, 1);
        assert.equal(mapped.cases[1].message, 'WA');
        assert.equal(mapOpenVJudgeResult({ verdict: 'accepted' }).status, STATUS.STATUS_ACCEPTED);
        assert.equal(mapOpenVJudgeResult({ verdict: 'compilation_error' }).status, STATUS.STATUS_COMPILE_ERROR);
    });

    it('inherits legacy language mappings and resolves local and legacy keys', () => {
        const source = yaml.dump({
            'cc.cc17': { display: 'C++17', validAs: { judgeclient: 'judgeclient.0' } },
            c: { display: 'C' },
            custom: { display: 'Custom' },
        });
        const updated = addOpenVJudgeLanguageMappings(source);
        const config = yaml.load(updated);
        assert.equal(config['cc.cc17'].validAs['open-vjudge'], 'judgeclient.0');
        assert.equal(config.c.validAs['open-vjudge'], 'c');
        assert.equal(config.custom.validAs, undefined);
        const langs = {
            'cc.cc17': { display: 'C++17', validAs: { judgeclient: 'judgeclient.0', 'open-vjudge': 'judgeclient.0' } },
            c: { display: 'C', validAs: { 'open-vjudge': 'c' } },
        };
        assert.deepEqual(resolveOpenVJudgeLanguage('cc.cc17', 'codeforces', langs), ['/GNU [CG]\\+\\+17\\b/i', '/[CG]\\+\\+/i']);
        assert.deepEqual(resolveOpenVJudgeLanguage('judgeclient.0', 'atcoder', langs), ['/C\\+\\+\\s*17\\b/i', '/[CG]\\+\\+/i']);
        assert.equal(resolveOpenVJudgeLanguage('codeforces.54', 'codeforces', langs), '54');
        assert.deepEqual(resolveOpenVJudgeLanguage('c', 'atcoder', langs), ['/C11\\b/i', '/(?:^|\\s)C(?:\\d|\\s|$)/i']);
        assert.throws(() => resolveOpenVJudgeLanguage('judgeclient.99', 'codeforces', langs), /legacy language/);
    });

    it('prioritizes the requested C++ version and falls back to any C++ compiler', () => {
        const langs = {
            'cc.cc17': { display: 'C++17' },
            'cc.cc20o2': { display: 'C++20 (O2)' },
            'cc.cc23': { display: 'C++23' },
        };
        // Model the remote API's ordered selector lookup, including remote-list order.
        const select = (selectors, available: string[]) => selectors
            .map((selector: string) => {
                const [, pattern, flags] = /^\/(.*)\/([a-z]*)$/.exec(selector);
                return available.find((name) => new RegExp(pattern, flags).test(name));
            }).find(Boolean);
        for (const key of Object.keys(langs)) {
            const selectors = resolveOpenVJudgeLanguage(key, 'atcoder', langs);
            assert.equal(select(selectors, ['C++23 (GCC 15.2)']), 'C++23 (GCC 15.2)');
        }
        const selectors = resolveOpenVJudgeLanguage('cc.cc17', 'atcoder', langs);
        assert.equal(select(selectors, ['C++23 (GCC 15.2)', 'C++17 (Clang 16)']), 'C++17 (Clang 16)');
        assert.equal(select(selectors, ['C11 (GCC 15.2)', 'C# 13', 'Python 3']), undefined);
        assert.deepEqual(resolveOpenVJudgeLanguage('cc.cc17', 'atcoder', { 'cc.cc17': {} }), selectors);
    });

    it('keeps explicit remote language IDs and selectors unchanged', () => {
        for (const judge of ['atcoder', 'codeforces', 'ybt']) {
            for (const language of ['54', '/C\\+\\+23/i', 'open-vjudge.6017', 'open-vjudge./C\\+\\+23/i']) {
                assert.equal(resolveOpenVJudgeLanguage(language, judge, {}), language.replace(/^open-vjudge\./, ''));
            }
        }
    });

    it('resolves YBT GCC, G++, G++14, and Python from local and legacy language keys', () => {
        const langs = {
            c: { display: 'C17' },
            'cc.cc14': { display: 'C++14' },
            'cc.cc17': { display: 'C++17', validAs: { judgeclient: 'judgeclient.0' } },
            'py.py3': { display: 'Python 3' },
        };
        const available = ['G++', 'G++14', 'GCC', 'Java', 'Pascal', 'Python'];
        const select = (key: string) => [resolveOpenVJudgeLanguage(key, 'ybt', langs)].flat()
            .map((selector: string) => {
                const [, pattern, flags] = /^\/(.*)\/([a-z]*)$/.exec(selector);
                return available.find((name) => new RegExp(pattern, flags).test(name));
            }).find(Boolean);
        assert.equal(select('c'), 'GCC');
        assert.equal(select('cc.cc14'), 'G++14');
        assert.equal(select('cc.cc17'), 'G++');
        assert.equal(select('judgeclient.0'), 'G++');
        assert.equal(select('py.py3'), 'Python');
        assert.equal(resolveOpenVJudgeLanguage('7', 'ybt', langs), '7');
    });

    it('falls back within the same language for other versioned mappings', () => {
        const langs = { c: { display: 'C17' }, 'py.py3': { display: 'Python 3' }, 'py.pypy3': { display: 'PyPy 3' } };
        assert.deepEqual(resolveOpenVJudgeLanguage('c', 'atcoder', langs), ['/C17\\b/i', '/(?:^|\\s)C(?:\\d|\\s|$)/i']);
        assert.deepEqual(resolveOpenVJudgeLanguage('py.py3', 'atcoder', langs), ['/Python.*3/i', '/Python/i']);
        assert.deepEqual(resolveOpenVJudgeLanguage('py.pypy3', 'atcoder', langs), ['/PyPy.*3/i', '/PyPy/i']);
    });
});

describe('OpenVJudge HTTP provider', () => {
    it('submits all three judges with the user key and consumes canonical results', async (t) => {
        Object.assign(SettingModel.langs, {
            'cc.cc17': { display: 'C++17', validAs: { 'open-vjudge': 'cc.cc17' } },
        });
        const submissions: Record<string, any> = {};
        const server = http.createServer((req, res) => {
            let body = '';
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', () => {
                assert.equal(req.headers['x-api-key'], 'user-key');
                res.setHeader('content-type', 'application/json');
                if (req.method === 'POST' && req.url === '/api/submit') {
                    const payload = JSON.parse(body);
                    const id = { codeforces: 'cf-job', atcoder: 'at-job', ybt: 'ybt-job' }[payload.judge];
                    submissions[id] = payload;
                    res.writeHead(202).end(JSON.stringify({ ok: true, job: { id, state: 'queued' } }));
                    return;
                }
                if (req.method === 'GET' && req.url?.startsWith('/api/jobs/cf-job')) {
                    res.end(JSON.stringify({
                        ok: true,
                        job: {
                            id: 'cf-job',
                            state: 'succeeded',
                            result: {
                                state: 'final', verdict: 'accepted', score: 100, timeMs: 15, memoryKb: 1024,
                                tests: [{ index: 1, verdict: 'accepted', timeMs: 15, memoryKb: 1024 }],
                            },
                        },
                    }));
                    return;
                }
                if (req.method === 'GET' && req.url?.startsWith('/api/jobs/at-job')) {
                    res.end(JSON.stringify({
                        ok: true,
                        job: {
                            id: 'at-job',
                            state: 'succeeded',
                            result: { state: 'final', verdict: 'wrong_answer', timeMs: 20, memoryKb: 2048 },
                        },
                    }));
                    return;
                }
                if (req.method === 'GET' && req.url?.startsWith('/api/jobs/ybt-job')) {
                    res.end(JSON.stringify({
                        ok: true,
                        job: {
                            id: 'ybt-job',
                            state: 'succeeded',
                            result: {
                                state: 'final', verdict: 'partial', score: 10, timeMs: 30, memoryKb: 4096,
                                tests: [
                                    { index: 1, verdict: 'accepted', score: 10, timeMs: 10, memoryKb: 2048 },
                                    { index: 2, verdict: 'wrong_answer', score: 0, timeMs: 20, memoryKb: 4096 },
                                ],
                            },
                        },
                    }));
                    return;
                }
                res.writeHead(404).end(JSON.stringify({ ok: false, error: { message: 'not found' } }));
            });
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        t.after(() => new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        }));
        const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        const settings = { 'open-vjudge.endpoint': endpoint, 'open-vjudge.apiKey': 'user-key' };
        const provider = new OpenVJudgeProvider({
            _id: 'test', type: 'open-vjudge', handle: '', password: '',
        }, async () => { }, (key) => settings[key]);

        const ends: any[] = [];
        const end = (payload) => ends.push(payload);
        const cfJob = await provider.submitProblem('CF4A', 'cc.cc17', 'int main() {}', { rid: 'cf-record' }, () => { }, end);
        const atJob = await provider.submitProblem('abc097c', 'cc.cc17', 'int main() {}', { rid: 'at-record' }, () => { }, end);
        const ybtJob = await provider.submitProblem('YBT1001', 'cc.cc17', 'int main() {}', { rid: 'ybt-record' }, () => { }, end);
        assert.deepEqual(ends, []);
        assert.equal(cfJob, 'cf-job');
        assert.equal(atJob, 'at-job');
        assert.equal(ybtJob, 'ybt-job');
        assert.deepEqual(submissions['cf-job'].problem, '4A');
        assert.deepEqual(submissions['cf-job'].language, ['/GNU [CG]\\+\\+17\\b/i', '/[CG]\\+\\+/i']);
        assert.equal(submissions['cf-job'].source, 'int main() {}');
        assert.equal(submissions['cf-job'].meta.rid, 'cf-record');
        assert.equal(submissions['at-job'].contest, 'abc097');
        assert.equal(submissions['at-job'].task, 'abc097_c');
        assert.deepEqual(submissions['at-job'].language, ['/C\\+\\+\\s*17\\b/i', '/[CG]\\+\\+/i']);
        assert.equal(submissions['ybt-job'].judge, 'ybt');
        assert.equal(submissions['ybt-job'].problem, '1001');
        assert.equal(submissions['ybt-job'].contest, undefined);
        assert.equal(submissions['ybt-job'].task, undefined);
        assert.equal(submissions['ybt-job'].source, 'int main() {}');
        assert.equal(submissions['ybt-job'].meta.rid, 'ybt-record');
        assert.deepEqual(submissions['ybt-job'].language, ['/[CG]\\+\\+\\s*17\\b/i', '/[CG]\\+\\+/i']);

        await provider.waitForSubmission(cfJob, () => { }, end);
        await provider.waitForSubmission(atJob, () => { }, end);
        await provider.waitForSubmission(ybtJob, () => { }, end);
        assert.equal(ends.length, 3);
        assert.equal(ends[0].status, STATUS.STATUS_ACCEPTED);
        assert.equal(ends[0].cases[0].status, STATUS.STATUS_ACCEPTED);
        assert.equal(ends[0].time, 15);
        assert.equal(ends[1].status, STATUS.STATUS_WRONG_ANSWER);
        assert.equal(ends[1].memory, 2048);
        assert.equal(ends[2].status, STATUS.STATUS_WRONG_ANSWER);
        assert.equal(ends[2].score, 10);
        assert.equal(ends[2].time, 30);
        assert.equal(ends[2].memory, 4096);
        assert.equal(ends[2].cases[0].status, STATUS.STATUS_ACCEPTED);
        assert.equal(ends[2].cases[0].score, 10);
        assert.equal(ends[2].cases[1].status, STATUS.STATUS_WRONG_ANSWER);
    });

    it('reports missing configuration without sending a request or exposing the key', async () => {
        const provider = new OpenVJudgeProvider({
            _id: 'test', type: 'open-vjudge', handle: '', password: '',
        }, async () => { }, () => '');
        let result;
        const job = await provider.submitProblem('CF4A', '54', 'code', {}, () => { }, (payload) => { result = payload; });
        assert.equal(job, undefined);
        assert.equal(result.status, STATUS.STATUS_SYSTEM_ERROR);
        assert.match(result.message, /endpoint is not configured/);
        assert.doesNotMatch(result.message, /user-key/);
    });
});
