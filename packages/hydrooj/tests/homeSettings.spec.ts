import assert from 'assert';
import { beforeEach, describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

Object.assign(global, { Hydro: { model: {}, ui: {} } });
mock('../src/service/server', require('@hydrooj/framework'));
mock('../src/service/db', { collection: () => null });
mock('../src/service/bus', { on() {}, async parallel() { return undefined; } });
for (const name of ['blacklist', 'checkin', 'contest', 'discussion', 'domain', 'message', 'problem', 'storage', 'system', 'token', 'training']) {
    mock(`../src/model/${name}`, {});
}
const settings = [
    { key: 'hideRank', family: 'setting_info', type: 'boolean', flag: 0 },
    { key: 'school', family: 'setting_info', type: 'text', flag: 0 },
];
mock('../src/model/setting', {
    ACCOUNT_SETTINGS: settings,
    SETTINGS_BY_KEY: Object.fromEntries(settings.map((s) => [s.key, s])),
    FLAG_DISABLED: 4,
    FLAG_SECRET: 1,
});
const writes: unknown[] = [];
mock('../src/model/user', { setById: async (_uid: number, values: unknown) => { writes.push(values); } });
const { PERM } = require('../src/model/builtin');
const { PermissionError } = require('../src/error');
let settingsHandler;
require('../src/handler/home').apply({
    Route: (name: string, _url: string, HandlerClass: unknown) => {
        if (name === 'home_settings') settingsHandler = HandlerClass;
    },
    on() {},
});

function handler(canEdit: boolean) {
    return Object.assign(Object.create(settingsHandler.prototype), {
        user: { _id: 2, hideRank: false, hasPerm: (perm: bigint) => canEdit && perm === PERM.PERM_EDIT_DOMAIN },
        response: {},
        session: {},
        checkPerm: (perm: bigint) => {
            assert.equal(perm, PERM.PERM_EDIT_DOMAIN);
            if (!canEdit) throw new PermissionError(perm);
        },
        back() {},
    });
}

beforeEach(() => { writes.length = 0; });

describe('account leaderboard visibility permission', () => {
    it('only exposes the control to domain administrators', async () => {
        const regular = handler(false);
        await regular.get({}, 'account');
        assert.deepEqual(regular.response.body.settings.map((s) => s.key), ['school']);
        const admin = handler(true);
        await admin.get({}, 'account');
        assert.deepEqual(admin.response.body.settings.map((s) => s.key), ['hideRank', 'school']);
        assert.equal(settings.length, 2);
    });

    for (const category of ['account', 'preference', 'domain']) {
        for (const payload of [{ hideRank: 'on' }, { hideRank: false }, { booleanKeys: { hideRank: true } }]) {
            it(`rejects unauthorized ${category} submission ${JSON.stringify(payload)} before writing`, async () => {
                await assert.rejects(handler(false).post({ category, school: 'New school', ...payload }), PermissionError);
                assert.deepEqual(writes, []);
            });
        }
    }

    it('allows administrators to enable and disable the setting through both checkbox formats', async () => {
        const admin = handler(true);
        await admin.post({ category: 'account', hideRank: 'on' });
        await admin.post({ category: 'account', hideRank: false });
        await admin.post({ category: 'account', booleanKeys: { hideRank: true } });
        assert.deepEqual(writes, [{ hideRank: true }, { hideRank: false }, { hideRank: false }]);
    });

    it('lets regular users save other settings without changing leaderboard visibility', async () => {
        await handler(false).post({ category: 'account', school: 'New school' });
        assert.deepEqual(writes, [{ school: 'New school' }]);
    });
});
