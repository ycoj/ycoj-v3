import assert from 'assert';
import { describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

Object.assign(global, { Hydro: { model: {}, ui: {} } });

const framework = require('@hydrooj/framework');
mock('../src/service/server', {
    ...framework,
    requireSudo: (_target: unknown, _name: string, descriptor: PropertyDescriptor) => descriptor,
});
const calls: unknown[] = [];
const logs: unknown[] = [];
let failure: Error | null = null;
mock('../src/model/coinAdjust', {
    adjustDomainCoins: async (input: unknown) => {
        calls.push(input);
        if (failure) throw failure;
        return { adjustments: [{ uid: 12, amount: -20, balance: 80, applied: true }] };
    },
});
mock('../src/model/domain', { get: async () => ({ _id: 'school', name: 'School' }) });
mock('../src/model/oplog', {
    log: async (_handler: unknown, type: string, data: unknown) => { logs.push({ type, data }); },
});
const { PERM } = require('../src/model/builtin');
const { PermissionError } = require('../src/error');
const { RewardError } = require('../src/lib/rewards');
let coinHandler: { prototype: object };
require('../src/handler/domainCoin').apply({
    Route: (_name: string, _url: string, HandlerClass: { prototype: object }) => { coinHandler = HandlerClass; },
});

function handler(canEdit: boolean) {
    return Object.assign(Object.create(coinHandler.prototype), {
        user: { _id: 3, uname: 'teacher' },
        domain: { _id: 'school', name: 'School' },
        response: {} as { status?: number, body?: { error?: { message?: string } } },
        checkPerm(perm: bigint) {
            assert.equal(perm, PERM.PERM_EDIT_DOMAIN);
            if (!canEdit) throw new PermissionError(perm);
        },
        limitRate: async () => {},
    });
}

describe('domain coin adjustment permission', () => {
    it('rejects a user without domain-admin permission before any wallet change', async () => {
        calls.length = 0;
        logs.length = 0;
        failure = null;
        await assert.rejects(
            handler(false).postAdjust('school', [12], 'grant', 10, 'Class prize', 'request-01'),
            PermissionError,
        );
        assert.deepEqual(calls, []);
        assert.deepEqual(logs, []);
    });

    it('adjusts coins only after the domain-admin permission check', async () => {
        calls.length = 0;
        logs.length = 0;
        failure = null;
        const admin = handler(true);
        await admin.postAdjust('school', [12, 13], 'deduct', 20, 'Late homework', 'request-22');
        assert.deepEqual(calls, [{
            domainId: 'school',
            operatorUid: 3,
            operatorName: 'teacher',
            domainName: 'School',
            uids: [12, 13],
            direction: 'deduct',
            amount: 20,
            note: 'Late homework',
            requestId: 'request-22',
        }]);
        assert.equal(logs.length, 1);
        assert.equal(admin.response.body.adjustments[0].balance, 80);
    });

    it('returns the membership failure without writing an audit log', async () => {
        calls.length = 0;
        logs.length = 0;
        failure = new RewardError('user-not-in-domain');
        const admin = handler(true);
        await admin.postAdjust('school', [99], 'grant', 10, 'Class prize', 'request-99');
        assert.equal(admin.response.status, 400);
        assert.equal(admin.response.body.error.message, 'user-not-in-domain');
        assert.deepEqual(logs, []);
    });
});
