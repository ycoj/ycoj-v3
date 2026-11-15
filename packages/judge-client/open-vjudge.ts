/* eslint-disable no-await-in-loop */
import axios, { AxiosInstance } from 'axios';
import { STATUS } from '@hydrooj/common';
import { IBasicProvider, RemoteAccount } from '@hydrooj/vjudge/src/interface';
import { Logger, SettingModel, sleep, SystemModel } from 'hydrooj';
import {
    mapOpenVJudgeResult, OpenVJudgeResult, OpenVJudgeSubmissionTarget,
    parseOpenVJudgeProblem, resolveOpenVJudgeLanguage,
} from './open-vjudge-utils';

const logger = new Logger('remote/open-vjudge');
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 15 * 60 * 1000;

interface OpenVJudgeJob {
    id: string;
    state: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
    result?: OpenVJudgeResult | null;
    error?: { message?: string } | null;
}

type SettingGetter = (key: string) => any;

function normalizeBaseUrl(input: string) {
    return (input || '').trim().replace(/\/+$/, '');
}

function remoteError(error: any) {
    const message = error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || 'Unknown remote error';
    return new Error(`OpenVJudge request failed: ${message}`);
}

export default class OpenVJudgeProvider implements IBasicProvider {
    private client: AxiosInstance | null = null;
    private clientConfig = '';

    constructor(
        public account: RemoteAccount,
        private save: (data: any) => Promise<void>,
        private getSetting: SettingGetter = (key) => SystemModel.get(key),
    ) {
        void this.save;
    }

    private configuration() {
        const endpoint = normalizeBaseUrl(String(
            this.account.endpoint || this.getSetting('open-vjudge.endpoint') || '',
        ));
        const apiKey = String(
            this.account.password || this.getSetting('open-vjudge.apiKey') || '',
        ).trim();
        return { endpoint, apiKey };
    }

    private requireClient() {
        const { endpoint, apiKey } = this.configuration();
        if (!endpoint) throw new Error('OpenVJudge endpoint is not configured (open-vjudge.endpoint).');
        if (!apiKey) throw new Error('OpenVJudge user API key is not configured (open-vjudge.apiKey).');
        const key = `${endpoint}\n${apiKey}`;
        if (!this.client || this.clientConfig !== key) {
            this.client = axios.create({
                baseURL: endpoint,
                headers: { Accept: 'application/json', 'X-Api-Key': apiKey },
                timeout: 45000,
            });
            this.clientConfig = key;
        }
        return this.client;
    }

    async ensureLogin() {
        return true;
    }

    async getProblem(id: string, meta: Record<string, any>) {
        void id;
        void meta;
        return null as any;
    }

    async listProblem(page: number, resyncFrom: number, listId: string) {
        void page;
        void resyncFrom;
        void listId;
        return [];
    }

    private payload(target: OpenVJudgeSubmissionTarget, lang: string, code: string, info: any) {
        const language = resolveOpenVJudgeLanguage(lang, target.judge, SettingModel.langs);
        return {
            judge: target.judge,
            ...(target.problem ? { problem: target.problem } : {}),
            ...(target.contest ? { contest: target.contest } : {}),
            ...(target.task ? { task: target.task } : {}),
            language,
            source: code,
            meta: { rid: String(info?.rid || '') },
        };
    }

    async submitProblem(id: string, lang: string, code: string, info: any, next: any, end: any) {
        void next;
        if (!code?.length) {
            end({ status: STATUS.STATUS_COMPILE_ERROR, message: 'Empty code' });
            return undefined;
        }
        try {
            const target = parseOpenVJudgeProblem(id);
            const { data } = await this.requireClient().post('/api/submit', this.payload(target, lang, code, info));
            if (!data?.ok || !data.job?.id) throw new Error(data?.error?.message || 'Invalid submit response.');
            return String(data.job.id);
        } catch (error) {
            end({ status: STATUS.STATUS_SYSTEM_ERROR, message: remoteError(error).message });
            return undefined;
        }
    }

    async waitForSubmission(id: string, next: any, end: any) {
        const startedAt = Date.now();
        let failures = 0;
        try {
            this.requireClient();
        } catch (error) {
            end({ status: STATUS.STATUS_SYSTEM_ERROR, message: remoteError(error).message });
            return;
        }
        while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
            let job: OpenVJudgeJob;
            try {
                const { data } = await this.requireClient().get(`/api/jobs/${encodeURIComponent(id)}`, {
                    params: { wait: 1, timeout: 30000 },
                });
                if (!data?.ok || !data.job) throw new Error(data?.error?.message || 'Invalid job response.');
                job = data.job;
                failures = 0;
            } catch (error) {
                failures++;
                if (failures < 3) {
                    await sleep(POLL_INTERVAL_MS);
                    continue;
                }
                end({ status: STATUS.STATUS_SYSTEM_ERROR, message: remoteError(error).message });
                return;
            }

            if (job.state === 'succeeded') {
                if (!job.result || job.result.state !== 'final') {
                    end({
                        status: STATUS.STATUS_SYSTEM_ERROR,
                        message: job.result?.error?.message || 'Remote judging did not produce a final result.',
                    });
                    return;
                }
                end(mapOpenVJudgeResult(job.result));
                return;
            }
            if (job.state === 'failed' || job.state === 'canceled') {
                end({
                    status: job.state === 'canceled' ? STATUS.STATUS_CANCELED : STATUS.STATUS_SYSTEM_ERROR,
                    message: job.error?.message || `Remote job ${job.state}.`,
                });
                return;
            }
            await next({
                status: job.state === 'queued' ? STATUS.STATUS_WAITING : STATUS.STATUS_JUDGING,
                progress: Math.min(95, Math.max(5, Math.floor((Date.now() - startedAt) / POLL_TIMEOUT_MS * 95))),
            });
            await sleep(POLL_INTERVAL_MS);
        }
        logger.error('Remote judging timed out.', { jobId: id });
        end({ status: STATUS.STATUS_SYSTEM_ERROR, message: 'Remote judging timed out.' });
    }
}
