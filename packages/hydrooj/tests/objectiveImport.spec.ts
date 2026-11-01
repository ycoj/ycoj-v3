import assert from 'assert';
import { beforeEach, describe, it } from 'node:test';
import { ProblemNotFoundError, ValidationError } from '../src/error';

function mockModule(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

const PERM = {
    PERM_CREATE_PROBLEM: 1n,
    PERM_VIEW_PROBLEM: 2n,
    PERM_EDIT_PROBLEM_SELF: 4n,
    PERM_EDIT_PROBLEM: 8n,
};
const permissions = new Set<bigint>();
let created: unknown[][] = [];
let source = makeSource();

function makeSource() {
    return {
        docId: 1001, pid: 'P1001', owner: 7, title: 'CSP-J', hidden: false,
        content: '题目 ![](file://diagram.png) {{ select(1) }}\n\n- A\n- B',
        config: 'type: objective\nanswers:\n  1: [B, 2]',
        reference: undefined as { domainId: string, pid: number } | undefined,
        html: false,
    };
}

class Handler {
    user = {
        _id: 7,
        viewLang: 'zh',
        hasPerm: (perm: bigint) => permissions.has(perm),
        own: (doc: { owner: number }, perm: bigint) => doc.owner === 7 && permissions.has(perm),
    };

    response: { body?: unknown, redirect?: string } = {};

    checkPerm(perm: bigint) {
        if (!permissions.has(perm)) throw new Error('Permission denied');
    }

    async limitRate() {}

    url(_name: string, { paperId }: { paperId: string }) {
        return `/preliminary/${paperId}/edit`;
    }
}

mockModule('../src/model/builtin', { PERM, PRIV: {} });
mockModule('../src/model/preliminary', {
    add: async (...args: unknown[]) => {
        created.push(args);
        return 'paper1';
    },
});
mockModule('../src/model/problem', {
    __esModule: true,
    default: {
        PROJECTION_PUBLIC: ['config'],
        get: async (_domain: string, _pid: number, _projection: string[], raw: boolean) => {
            assert.equal(raw, true);
            return source;
        },
        canViewBy: (doc: typeof source) => !doc.hidden,
    },
});
mockModule('../src/model/user', { __esModule: true, default: {} });
mockModule('../src/service/server', {
    Handler,
    param: () => () => {},
    post: () => () => {},
    Types: { Range: () => {} },
});

type ImportHandler = Handler & {
    prepare: () => Promise<void>;
    postImport: (domainId: string, pid: number) => Promise<void>;
};
let ImportHandlerClass: new () => ImportHandler;
require('../src/handler/preliminary').apply({
    on: () => {},
    injectUI: () => {},
    Route: (name: string, _path: string, handler: new () => ImportHandler) => {
        if (name === 'preliminary_import') ImportHandlerClass = handler;
    },
});

beforeEach(() => {
    source = makeSource();
    created = [];
    permissions.clear();
    permissions.add(PERM.PERM_CREATE_PROBLEM);
    permissions.add(PERM.PERM_VIEW_PROBLEM);
    permissions.add(PERM.PERM_EDIT_PROBLEM_SELF);
});

describe('objective import permissions and draft creation', () => {
    it('requires creation and view permissions', async () => {
        for (const perm of [PERM.PERM_CREATE_PROBLEM, PERM.PERM_VIEW_PROBLEM]) {
            permissions.delete(perm);
            await assert.rejects(new ImportHandlerClass().prepare(), /Permission denied/);
            permissions.add(perm);
        }
        assert.equal(created.length, 0);
    });

    it('requires permission to edit the source before copying standard answers', async () => {
        source.owner = 8;
        await assert.rejects(new ImportHandlerClass().postImport('system', 1001), /Permission denied/);
        assert.equal(created.length, 0);
    });

    it('rejects an inaccessible hidden source even with edit-any permission', async () => {
        source.hidden = true;
        permissions.add(PERM.PERM_EDIT_PROBLEM);
        await assert.rejects(new ImportHandlerClass().postImport('system', 1001), ProblemNotFoundError);
        assert.equal(created.length, 0);
    });

    it('rejects unsupported source formats before creating a paper', async () => {
        for (const update of [{ html: true }, { reference: { domainId: 'other', pid: 1 } }, { config: 'type: default' }]) {
            source = { ...makeSource(), ...update };
            await assert.rejects(new ImportHandlerClass().postImport('system', 1001), ValidationError);
        }
        assert.equal(created.length, 0);
    });

    it('creates an unpublished copy owned by the caller and opens its editor', async () => {
        const original = structuredClone(source);
        const handler = new ImportHandlerClass();
        await handler.prepare();
        await handler.postImport('school', 1001);
        assert.equal(created.length, 1);
        const [domainId, definition, owner, published] = created[0];
        assert.equal(domainId, 'school');
        assert.equal(owner, 7);
        assert.equal(published, false);
        assert.match(JSON.stringify(definition), /\/api\/d\/school\/p\/1001\/file\/diagram.png/);
        assert.deepEqual(source, original);
        assert.deepEqual(handler.response.body, { paperId: 'paper1' });
        assert.equal(handler.response.redirect, '/preliminary/paper1/edit');
    });
});
