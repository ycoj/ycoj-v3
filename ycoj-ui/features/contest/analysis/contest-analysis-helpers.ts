import type {
  ContestAnalysisJobStatus,
  ContestAnalysisStage,
} from '@/shared/types/contest-analysis';

export const ACTIVE_ANALYSIS_STATUSES: ContestAnalysisJobStatus[] = [
  'pending',
  'running',
];

export function isActiveAnalysisStatus(status: ContestAnalysisJobStatus) {
  return ACTIVE_ANALYSIS_STATUSES.includes(status);
}

export const ANALYSIS_STAGE_KEYS: Record<ContestAnalysisStage, string> = {
  waiting: 'stages.waiting',
  preparing: 'stages.preparing',
  overview: 'stages.overview',
  students: 'stages.students',
  finalizing: 'stages.finalizing',
  done: 'stages.done',
  failed: 'stages.failed',
  cancelled: 'stages.cancelled',
  timed_out: 'stages.timed_out',
};

export function getAnalysisStageKey(stage: ContestAnalysisStage) {
  return ANALYSIS_STAGE_KEYS[stage] ?? 'stages.waiting';
}

export const ANALYSIS_TOOL_KEYS: Record<string, string> = {
  get_scope_overview: 'tools.getScopeOverview',
  list_contests: 'tools.listContests',
  get_contest: 'tools.getContest',
  list_problems: 'tools.listProblems',
  get_tag_statistics: 'tools.getTagStatistics',
  list_students: 'tools.listStudents',
  get_student: 'tools.getStudent',
  search_students: 'tools.searchStudents',
  submit_overall_analysis: 'tools.submitOverview',
  submit_student_reports: 'tools.submitStudents',
};

export function getAnalysisEventKey(code?: string) {
  if (!code) return '';
  const keys: Record<string, string> = {
    created: 'events.created',
    recreated: 'events.recreated',
    prepare: 'events.prepare',
    overview: 'events.overview',
    overview_retry: 'events.overviewRetry',
    student_batch: 'events.studentBatch',
    finalize: 'events.finalize',
  };
  return keys[code] || '';
}

export function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function percentage(value: number, fractionDigits = 1) {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}
