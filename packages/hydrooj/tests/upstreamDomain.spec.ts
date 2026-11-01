import assert from 'assert';
import { beforeEach, describe, it } from 'node:test';

function mock(request: string, exports: unknown) {
    require.cache[require.resolve(request)] = { exports } as NodeJS.Module;
}

interface Member { domainId: string, uid: number, role: string, join?: boolean }
let members: Member[];
let writes: number;
const invalidated: number[] = [];
mock('../src/service/db', {
    collection: (name: string) => name === 'domain.user' ? {
        bulkWrite: async (operations: any[]) => {
            for (const { updateOne: { filter, update, upsert } } of operations) {
                let member = members.find((entry) => entry.domainId === filter.domainId && entry.uid === filter.uid);
                if (!member && upsert) {
                    member = { ...filter };
                    members.push(member);
                }
                Object.assign(member, update.$set);
                writes++;
            }
            return { acknowledged: true };
        },
    } : {},
});
mock('../src/service/bus', {});
mock('../src/model/user', {
    getMulti: () => ({ project: () => ({ toArray: async () => [{ _id: 12 }, { _id: 13 }] }) }),
    deleteUserCache: (user: { _id: number }) => invalidated.push(user._id),
});
mock('../src/utils', { ArgMethod: (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor });
(global as any).Hydro = { model: {} };
const DomainModel = require('../src/model/domain').default;

beforeEach(() => {
    members = [{ domainId: 'school', uid: 12, role: 'guest' }, { domainId: 'other', uid: 13, role: 'guest' }];
    writes = 0;
    invalidated.length = 0;
});

describe('upstream batch role assignment regression', () => {
    it('updates existing members and creates each missing member once in the correct domain', async () => {
        await DomainModel.setUserRole('school', [12, 13, 12], 'member', true);
        assert.deepEqual(members, [
            { domainId: 'school', uid: 12, role: 'member', join: true },
            { domainId: 'other', uid: 13, role: 'guest' },
            { domainId: 'school', uid: 13, role: 'member', join: true },
        ]);
        assert.equal(writes, 2);
        assert.deepEqual(invalidated, [12, 13]);
    });

    it('makes no writes and performs no cache invalidation for an empty batch', async () => {
        assert.equal(await DomainModel.setUserRole('school', [], 'member'), undefined);
        assert.equal(writes, 0);
        assert.deepEqual(invalidated, []);
    });
});
