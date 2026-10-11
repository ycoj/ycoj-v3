import { parentPort, workerData } from 'worker_threads';
import { compareCpp, type CppComparison, PlagiarismLimitError, prepareCpp, SOFT_TIMEOUT_MS } from './engine';
import {
    PLAGIARISM_TASK_TIMEOUT_MS,
    type PlagiarismComparisonOutput, type PlagiarismSourceInput, type PlagiarismWorkerMessage, type PreparedPlagiarismSource,
} from './executor';

function send(message: PlagiarismWorkerMessage) {
    parentPort?.postMessage(message);
}

function compareSources(sources: PlagiarismSourceInput[]): PlagiarismComparisonOutput {
    const started = Date.now();
    const deadline = started + PLAGIARISM_TASK_TIMEOUT_MS;
    const prepared: PlagiarismComparisonOutput['prepared'] = [];
    const skipped: PlagiarismComparisonOutput['skipped'] = [];
    const groups = new Map<number, PlagiarismSourceInput[]>();
    for (const source of sources) {
        const group = groups.get(source.pid);
        if (group) group.push(source);
        else groups.set(source.pid, [source]);
    }
    let totalPairs = [...groups.values()].reduce((total, group) => total + group.length * (group.length - 1) / 2, 0);
    const pairs: PlagiarismComparisonOutput['pairs'] = [];
    send({ type: 'progress', progress: { completedPairs: 0, totalPairs } });
    // Keep only one problem's prepared feature maps in memory. A source is tokenized once,
    // and its maps become collectible when all pairs for that problem have completed.
    for (const group of groups.values()) {
        const ready: PreparedPlagiarismSource[] = [];
        for (const source of group) {
            if (Date.now() >= deadline) throw new Error('Plagiarism check exceeded five minutes.');
            try {
                const analyzed = prepareCpp(source.code);
                ready.push({ ...source, prepared: analyzed });
                prepared.push({ rid: source.rid, tokenCount: analyzed.tokenCount, warnings: analyzed.warnings });
            } catch (error: unknown) {
                skipped.push({ rid: source.rid, reason: error instanceof Error ? error.message : 'C++ source could not be analyzed.' });
            }
        }
        totalPairs -= (group.length * (group.length - 1) - ready.length * (ready.length - 1)) / 2;
        send({ type: 'progress', progress: { completedPairs: pairs.length, totalPairs } });
        for (let i = 0; i < ready.length; i++) {
            for (let j = i + 1; j < ready.length; j++) {
                if (Date.now() >= deadline) throw new Error('Plagiarism check exceeded five minutes.');
                const left = ready[i];
                const right = ready[j];
                let comparison: CppComparison;
                try {
                    comparison = compareCpp(left.prepared, right.prepared, {
                        deadline: Math.min(deadline, Date.now() + SOFT_TIMEOUT_MS),
                    });
                } catch (error: unknown) {
                    // A pair that exceeds the soft timeout is omitted rather than failing the whole job.
                    if (error instanceof PlagiarismLimitError && error.code === 'deadline-exceeded') {
                        totalPairs--;
                        continue;
                    }
                    throw error;
                }
                pairs.push({
                    pid: left.pid, leftRid: left.rid, rightRid: right.rid, ...comparison,
                });
                if (pairs.length % 10 === 0) send({ type: 'progress', progress: { completedPairs: pairs.length, totalPairs } });
            }
        }
        send({ type: 'progress', progress: { completedPairs: pairs.length, totalPairs } });
    }
    return {
        prepared,
        skipped, pairs, elapsedMs: Date.now() - started,
    };
}

if (parentPort) {
    try {
        send({ type: 'complete', result: compareSources(workerData as PlagiarismSourceInput[]) });
    } catch (error: unknown) {
        send({
            type: 'failed', error: error instanceof Error ? error.message : 'Plagiarism comparison failed.',
            ...(error instanceof PlagiarismLimitError ? { code: error.code } : {}),
        });
    }
}
