import { Worker } from 'worker_threads';
import { type PlagiarismLimitCode, PlagiarismLimitError, type PreparedCpp } from './engine';

export const PLAGIARISM_TASK_TIMEOUT_MS = 300_000;

export interface PlagiarismSourceInput { rid: string, pid: number, code: string }
export interface PlagiarismProgress { completedPairs: number, totalPairs: number }
export interface PlagiarismComparisonOutput {
    prepared: { rid: string, tokenCount: number, warnings: string[] }[];
    skipped: { rid: string, reason: string }[];
    pairs: {
        pid: number; leftRid: string; rightRid: string; similarity: number;
        scores: { token: number, structure: number, fingerprint: number };
        matches: { leftStartLine: number, leftEndLine: number, rightStartLine: number, rightEndLine: number, tokenCount: number }[];
        warnings: string[];
    }[];
    elapsedMs: number;
}
export type PlagiarismWorkerMessage =
    | { type: 'progress', progress: PlagiarismProgress }
    | { type: 'complete', result: PlagiarismComparisonOutput }
    | { type: 'failed', error: string, code?: PlagiarismLimitCode };
export type PreparedPlagiarismSource = PlagiarismSourceInput & { prepared: PreparedCpp };

// CPU work has its own heap and a hard wall-clock termination timer. An AbortSignal alone
// cannot interrupt synchronous matching on the HTTP worker's event loop.
export function runPlagiarismComparisons(
    sources: PlagiarismSourceInput[], signal: AbortSignal,
    onProgress?: (progress: PlagiarismProgress) => Promise<void> | void,
): Promise<PlagiarismComparisonOutput> {
    if (signal.aborted) return Promise.reject(new Error('Plagiarism check aborted.'));
    return new Promise((resolve, reject) => {
        const entry = require.resolve('./worker');
        const worker = new Worker(`require(${JSON.stringify(entry)});`, {
            eval: true,
            execArgv: ['-r', require.resolve('@hydrooj/register')],
            workerData: sources,
            resourceLimits: { maxOldGenerationSizeMb: 192, stackSizeMb: 4 },
        });
        let settled = false;
        let receivedResult = false;
        let progressWrites = Promise.resolve();
        let timer: NodeJS.Timeout;
        let abort: () => void;
        const finish = (error?: Error, result?: PlagiarismComparisonOutput) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal.removeEventListener('abort', abort);
            void worker.terminate();
            if (error) reject(error);
            else resolve(result!);
        };
        abort = () => finish(new Error('Plagiarism check aborted.'));
        timer = setTimeout(() => finish(new Error('Plagiarism check exceeded five minutes.')), PLAGIARISM_TASK_TIMEOUT_MS);
        timer.unref();
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        worker.on('message', (message: PlagiarismWorkerMessage) => {
            if (settled) return;
            if (message.type === 'failed') {
                finish(message.code ? new PlagiarismLimitError(message.code, message.error) : new Error(message.error));
            } else if (message.type === 'progress') {
                progressWrites = progressWrites.then(() => {
                    if (!settled) return onProgress?.(message.progress);
                    return undefined;
                });
                void progressWrites.catch((error: unknown) => finish(error instanceof Error ? error : new Error('Failed to save progress.')));
            } else if (message.type === 'complete') {
                receivedResult = true;
                void progressWrites.then(() => finish(undefined, message.result), (error: unknown) => {
                    finish(error instanceof Error ? error : new Error('Failed to save progress.'));
                });
            }
        });
        worker.once('error', (error) => finish(error));
        worker.once('exit', (code) => {
            if (!settled && !receivedResult) finish(new Error(`Plagiarism worker exited before completing (code ${code}).`));
        });
    });
}
