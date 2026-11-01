import { alova } from '@/api/server';

export type JudgeStatusOsInfo = {
  distro?: string;
  release?: string;
  codename?: string;
  arch?: string;
  kernel?: string;
};

export type JudgeStatusCpuInfo = {
  manufacturer?: string;
  brand?: string;
  speed?: number;
  flags?: string;
};

export type JudgeStatusMemoryInfo = {
  used?: number;
  total?: number;
};

export type JudgeStatusNode = {
  _id: string;
  type?: string;
  isOnline?: boolean;
  /** `Online` or `Offline`, decorated by the backend. */
  status?: string;
  updateAt?: string;
  osinfo?: JudgeStatusOsInfo;
  cpu?: JudgeStatusCpuInfo;
  memory?: JudgeStatusMemoryInfo;
  /** Normalized description such as `No battery` or `ACME X 80% Charging`. */
  battery?: string;
  reqCount?: number;
  stack?: number;
  compilers?: Record<string, string>;
};

export type JudgeStatusCompiler = {
  key: string[];
  message: string;
};

export type JudgeStatusResponse = {
  stats: JudgeStatusNode[];
  /** Display label (including the language key) to execution command. */
  languages: Record<string, string>;
  compilers: JudgeStatusCompiler[];
};

/** GET /status — public judge node status snapshot. */
export const getJudgeStatus = () =>
  alova.Get<JudgeStatusResponse>('/status', { cacheFor: 0 });
