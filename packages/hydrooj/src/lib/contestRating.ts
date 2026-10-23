export const RATING_VERSION = 1;
export const RATING_PARAMETERS = { performanceNoise: 200, monthlyDrift: 20, provisionalDeviation: 120, minContests: 3 } as const;
export const RATING_POPULATIONS = {
    open: { mean: 1500, spread: 450, calibration: 250 },
    primary: { mean: 1000, spread: 250, calibration: 150 },
    junior: { mean: 1600, spread: 250, calibration: 150 },
    senior: { mean: 2000, spread: 250, calibration: 150 },
} as const;
export type RatingPopulation = keyof typeof RATING_POPULATIONS;
export interface RatingParticipant { uid: number, rank: number }
export type RatingChange = RatingParticipant & { before: number, after: number, delta: number, provisional: boolean };
export interface RatingSummary { rating: number, peak: number, contests: number, provisional: boolean }
interface Student { index: number, group: number, baseline: number, at: number, contests: number, peak: number }
interface Site { a: number, b: number, precision: number, natural: number }

export function isRatingPopulation(value: string): value is RatingPopulation {
    return Object.hasOwn(RATING_POPULATIONS, value);
}

function normalRatio(t: number) {
    if (t < -8) {
        const x = -t;
        return x + 1 / x - 2 / x ** 3 + 10 / x ** 5;
    }
    const x = Math.abs(t) / Math.SQRT2;
    const z = 1 / (1 + 0.3275911 * x);
    const erfc = (((((1.061405429 * z - 1.453152027) * z) + 1.421413741) * z - 0.284496736) * z + 0.254829592) * z * Math.exp(-x * x);
    const cdf = t < 0 ? erfc / 2 : 1 - erfc / 2;
    return Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI) / Math.max(cdf, 1e-300);
}

/** Joint Gaussian filtering preserves the uncertainty shared by an entire population. */
export class ContestRatingEngine {
    private means: number[] = [];
    private covariance: number[][] = [];
    private groups = new Map<RatingPopulation, number>();
    private students = new Map<number, Student>();

    private addVariable(variance: number) {
        const index = this.means.length;
        this.means.push(0);
        for (const row of this.covariance) row.push(0);
        this.covariance.push(Array.from({ length: index + 1 }, () => 0));
        this.covariance[index][index] = variance;
        return index;
    }

    private student(uid: number, population: RatingPopulation, at: number) {
        let student = this.students.get(uid);
        if (!student) {
            const profile = RATING_POPULATIONS[population];
            if (!this.groups.has(population)) this.groups.set(population, this.addVariable(profile.calibration ** 2));
            student = {
                index: this.addVariable(profile.spread ** 2), group: this.groups.get(population),
                baseline: profile.mean, at, contests: 0, peak: -Infinity,
            };
            this.students.set(uid, student);
        }
        this.covariance[student.index][student.index] += RATING_PARAMETERS.monthlyDrift ** 2 * Math.max(0, at - student.at) / (30 * 86400000);
        student.at = at;
        return student;
    }

    getUser(uid: number): RatingSummary | null {
        const s = this.students.get(uid);
        if (!s) return null;
        const rating = Math.round(s.baseline + this.means[s.index] + this.means[s.group]);
        const variance = this.covariance[s.index][s.index] + this.covariance[s.group][s.group]
            + 2 * this.covariance[s.index][s.group];
        return {
            rating, peak: Math.max(rating, s.peak), contests: s.contests,
            provisional: s.contests < RATING_PARAMETERS.minContests || variance > RATING_PARAMETERS.provisionalDeviation ** 2,
        };
    }

    getUsers() {
        return [...this.students.keys()].map((uid) => ({ uid, ...this.getUser(uid) }));
    }

    rate(
        participants: RatingParticipant[], population: RatingPopulation, at: number, beta: number = RATING_PARAMETERS.performanceNoise,
    ): RatingChange[] {
        const ranked = [...participants].sort((a, b) => a.rank - b.rank || a.uid - b.uid);
        if (new Set(ranked.map((p) => p.uid)).size !== ranked.length
            || ranked.some((p) => !Number.isFinite(p.rank) || p.rank <= 0 || !Number.isInteger(p.uid))) {
            throw new Error('Invalid rating participants');
        }
        if (!(beta > 0) || !Number.isFinite(beta) || !Number.isFinite(at)) throw new Error('Invalid rating parameters');
        if (ranked.length < 2 || ranked[0].rank === ranked.at(-1).rank) return [];
        const students = ranked.map((p) => this.student(p.uid, population, at));
        const before = ranked.map((p) => this.getUser(p.uid).rating);
        const size = this.means.length;
        const means = [...this.means];
        const covariance = this.covariance.map((row) => [...row]);
        for (let i = 0; i < students.length; i++) {
            const s = students[i];
            means.push(s.baseline + this.means[s.index] + this.means[s.group]);
            const cross = this.means.map((_, j) => this.covariance[j][s.index] + this.covariance[j][s.group]);
            for (let j = 0; j < i; j++) {
                const other = students[j];
                cross.push(this.covariance[s.index][other.index] + this.covariance[s.group][other.index]
                    + this.covariance[s.index][other.group] + this.covariance[s.group][other.group]);
            }
            for (const [j, v] of cross.entries()) covariance[j].push(v);
            covariance.push([...cross, this.covariance[s.index][s.index] + this.covariance[s.group][s.group]
            + 2 * this.covariance[s.index][s.group] + beta ** 2]);
        }
        const blocks: number[][] = [];
        for (const [i, p] of ranked.entries()) {
            if (!i || p.rank !== ranked[i - 1].rank) blocks.push([]);
            blocks.at(-1).push(size + i);
        }
        const sites: Site[] = [];
        for (let i = 1; i < blocks.length; i++) {
            for (const a of blocks[i - 1]) {
                for (const b of blocks[i]) sites.push({ a, b, precision: 0, natural: 0 });
            }
        }
        // Each site constrains shared performance variables; EP removes its previous contribution before updating.
        for (let pass = 0; pass < 40; pass++) {
            let maxChange = 0;
            const ordered = pass % 2 ? [...sites].reverse() : sites;
            for (const site of ordered) {
                const { a, b } = site;
                const mean = means[a] - means[b];
                const variance = covariance[a][a] + covariance[b][b] - 2 * covariance[a][b];
                const cavityPrecision = 1 / variance - site.precision;
                if (!(cavityPrecision > 0)) continue;
                const cavityVariance = 1 / cavityPrecision;
                const cavityMean = cavityVariance * (mean / variance - site.natural);
                const t = cavityMean / Math.sqrt(cavityVariance);
                const ratio = normalRatio(t);
                const tiltedMean = cavityMean + Math.sqrt(cavityVariance) * ratio;
                const tiltedVariance = cavityVariance * Math.max(1e-8, 1 - ratio * (ratio + t));
                const precision = (1 / tiltedVariance - cavityPrecision) * 0.5 + site.precision * 0.5;
                const natural = (tiltedMean / tiltedVariance - cavityMean / cavityVariance) * 0.5 + site.natural * 0.5;
                const dp = precision - site.precision;
                const dn = natural - site.natural;
                const denominator = 1 + dp * variance;
                const cross = covariance.map((row) => row[a] - row[b]);
                const shift = (dn - dp * mean) / denominator;
                for (let i = 0; i < means.length; i++) {
                    const change = cross[i] * shift;
                    means[i] += change;
                    maxChange = Math.max(maxChange, Math.abs(change));
                    for (let j = 0; j <= i; j++) {
                        covariance[i][j] -= cross[i] * cross[j] * dp / denominator;
                        covariance[j][i] = covariance[i][j];
                    }
                }
                site.precision = precision;
                site.natural = natural;
            }
            if (pass > 2 && maxChange < 1e-5) break;
        }
        this.means = means.slice(0, size);
        this.covariance = covariance.slice(0, size).map((row) => row.slice(0, size));
        return ranked.map((p, i) => {
            const s = students[i];
            s.contests++;
            const summary = this.getUser(p.uid);
            s.peak = Math.max(s.peak, summary.rating);
            return { ...p, before: before[i], after: summary.rating, delta: summary.rating - before[i], provisional: summary.provisional };
        });
    }
}
