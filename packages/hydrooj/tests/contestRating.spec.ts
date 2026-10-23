import assert from 'assert/strict';
import { describe, it } from 'node:test';
import { ContestRatingEngine } from '../src/lib/contestRating';

const field = Array.from({ length: 15 }, (_, i) => ({ uid: i + 1, rank: i + 1 }));
const at = Date.UTC(2026, 0, 1);

describe('population-calibrated contest rating', () => {
    it('produces finite, ordered and symmetric results for a 15-person contest', () => {
        const engine = new ContestRatingEngine();
        const result = engine.rate(field, 'primary', at);
        assert.equal(result.length, 15);
        assert.ok(Math.abs(result[0].after - 1339) < 30);
        assert.ok(Math.abs(result[0].after + result[14].after - 2000) <= 1);
        for (const [i, r] of result.entries()) {
            assert.ok(Number.isFinite(r.after));
            assert.equal(r.delta, r.after - r.before);
            if (i) assert.ok(r.after <= result[i - 1].after);
        }
    });
    it('places new populations on different baselines without granting existing students a reset', () => {
        const primary = new ContestRatingEngine();
        const junior = new ContestRatingEngine();
        const a = primary.rate(field, 'primary', at);
        const b = junior.rate(field, 'junior', at);
        assert.equal(b[0].after - a[0].after, 600);
        const previous = primary.getUser(1).rating;
        const next = primary.rate(field, 'senior', at + 86400000);
        assert.equal(next[0].before, previous);
    });
    it('does not manufacture information from one participant or an entirely tied field', () => {
        const engine = new ContestRatingEngine();
        assert.deepEqual(engine.rate(field.map((p) => ({ ...p, rank: 1 })), 'primary', at), []);
        assert.deepEqual(engine.rate(field.slice(0, 1), 'primary', at), []);
        assert.equal(engine.getUser(1), null);
    });
    it('treats tied students equally and ignores input order', () => {
        const tied = field.map((p) => ({ ...p, rank: p.rank <= 3 ? 1 : 4 }));
        const a = new ContestRatingEngine().rate(tied, 'primary', at);
        const b = new ContestRatingEngine().rate([...tied].reverse(), 'primary', at);
        assert.deepEqual(a, b);
        assert.ok(Math.max(...a.slice(0, 3).map((p) => p.after)) - Math.min(...a.slice(0, 3).map((p) => p.after)) <= 1);
    });
    it('keeps a closed population provisional and reduces ordinary per-contest adjustments', () => {
        const engine = new ContestRatingEngine();
        const first = engine.rate(field, 'primary', at);
        let last = first;
        for (let i = 1; i < 12; i++) last = engine.rate(field, 'primary', at + i * 86400000);
        assert.ok(Math.abs(last[0].delta) < Math.abs(first[0].delta));
        assert.equal(engine.getUser(8).provisional, true);
        assert.equal(engine.getUser(8).contests, 12);
    });
    it('rejects duplicate participants and malformed ranks', () => {
        const engine = new ContestRatingEngine();
        assert.throws(() => engine.rate([field[0], field[0]], 'open', at));
        assert.throws(() => engine.rate([{ uid: 1, rank: Number.NaN }], 'open', at));
    });
    it('propagates cross-population calibration to students outside the bridge contest', () => {
        const engine = new ContestRatingEngine();
        engine.rate(field, 'primary', at);
        engine.rate(field.map((p) => ({ ...p, uid: p.uid + 100 })), 'junior', at);
        const before = engine.getUser(2).rating;
        engine.rate([{ uid: 8, rank: 1 }, { uid: 108, rank: 2 }], 'open', at + 86400000);
        assert.ok(engine.getUser(2).rating > before);
        assert.equal(engine.getUser(2).contests, 1);
    });
    it('converges toward stable abilities under noisy 15-person competitions', () => {
        const engine = new ContestRatingEngine();
        const truth = field.map((p, i) => ({ uid: p.uid, ability: 1000 + (i - 7) * 50 }));
        let seed = 20261023;
        const uniform = () => {
            seed = seed * 16807 % 2147483647;
            return seed / 2147483647;
        };
        const noise = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
        const initialError = Math.sqrt(truth.reduce((sum, s) => sum + (s.ability - 1000) ** 2, 0) / truth.length);
        const movement: number[] = [];
        for (let i = 0; i < 40; i++) {
            const participants = truth.map((s) => ({ uid: s.uid, performance: s.ability + 200 * noise() }))
                .sort((a, b) => b.performance - a.performance).map((s, rank) => ({ uid: s.uid, rank: rank + 1 }));
            const changes = engine.rate(participants, 'primary', at + i * 86400000);
            movement.push(changes.reduce((sum, s) => sum + Math.abs(s.delta), 0) / changes.length);
        }
        const finalError = Math.sqrt(truth.reduce((sum, s) => sum + (engine.getUser(s.uid).rating - s.ability) ** 2, 0) / truth.length);
        assert.ok(finalError < initialError / 2);
        assert.ok(movement.slice(-10).reduce((a, b) => a + b) < movement.slice(0, 10).reduce((a, b) => a + b));
    });
});
