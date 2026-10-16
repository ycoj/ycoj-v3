# AI contest analysis

The contest analysis endpoints return JSON directly. A manager selects one or more finished contests in the same domain and the server runs a persistent AI agent job over their scoreboards and problem metadata. The job writes a group-level review (weak knowledge points, difficulty gradient, algorithm coverage) and, unless disabled, one report per student. The endpoints never change contests, problems, submissions, scores, or rankings.

## Authorization and eligibility

Every endpoint reads the contests in the selected domain and requires the requesting user to manage all of them: owners/maintainers (`user.own(tdoc)`) must pass `PERM_EDIT_CONTEST_SELF`, every other user must pass `PERM_EDIT_CONTEST`. Attending the contest or holding `PERM_VIEW_CONTEST` grants no access.

- Each selected contest must be finished (`contest.isDone`) or the request fails with `ContestNotEndedError`.
- Each selected contest must show its scoreboard to the caller (`contest.canShowScoreboard`, which honours hidden-scoreboard permissions) or the request fails with `ContestScoreboardHiddenError`.
- Analysis jobs are shared per domain: `GET /contest/analysis` lists jobs created by the caller, plus every job when the caller has `PERM_EDIT_CONTEST`. Reading, cancelling, deleting, or retrying a job created by another user requires `PERM_EDIT_CONTEST`. The list only returns model profiles and `enabled: true` when the caller holds `PERM_EDIT_CONTEST` or `PERM_EDIT_CONTEST_SELF`.
- The feature requires the `contestAnalysis.enabled` system flag, falling back to `aiGeneration.enabled` when unset, and a model selected for contest analysis in the AI provider configuration. Otherwise list/create/retry fail with `ContestAnalysisUnavailableError` (HTTP 503).

Route `aid` is the server-generated job id (a UUID string), not an ObjectId. Contest ids are 24-hex ObjectId strings. All paths support the usual `/d/{domainId}` prefix and the ordinary `Cookie: sid=...` / `Authorization: Bearer {sid}` authentication.

## Routes and requests

| Method/path | Request type | Successful response |
| --- | --- | --- |
| `GET /contest/analysis` | No body | HTTP 200 `ContestAnalysisOverview` |
| `POST /contest/analysis` | `{ tids: ObjectId[]; title?: string; instructions?: string; includeStudents?: boolean; profileId?: string; language?: 'zh' \| 'en' }`; no `operation` field | HTTP 202 `{ jobId: string }` |
| `GET /contest/analysis/:aid` | No body | HTTP 200 `{ job: ContestAnalysisJob; canManage: boolean }` |
| `POST /contest/analysis/:aid` | `{ operation: 'cancel' }` | HTTP 200 `{ ok: true }` |
| `POST /contest/analysis/:aid` | `{ operation: 'delete' }` | HTTP 200 `{ ok: true }` |
| `POST /contest/analysis/:aid` | `{ operation: 'retry' }` | HTTP 202 `{ jobId: string }` |

Request rules:

- `tids` accepts 1–12 contest ids; duplicates are collapsed. An empty list, more than 12 contests, or an unknown id fails with `ValidationError`/`ContestNotFoundError` before a job is admitted.
- A contest with more than 200 participants fails the job while preparing, with the error stored on the job.
- `title` is at most 100 characters and defaults to the selected contest titles joined with ` · `. `instructions` is an optional coach hint of at most 2000 characters and is passed to the agent verbatim.
- `includeStudents` defaults to `true`; set it to `false` for a group-only report and to skip the per-student agent turns.
- `profileId` must be one of the ids returned by `GET /contest/analysis` (`profiles[].id`); omitted or unknown ids fall back to the configured default, and an invalid explicit id returns `ValidationError`.
- `language` is `zh` or `en` and defaults to `zh`. It only controls the language of the generated report text.
- `cancel` marks the job cancelled. In-flight work in the same worker is aborted immediately; a job running in another worker stops at its next checkpoint. `delete` removes the job document. `retry` admits a new job with the same scope, instructions and (when still available) model; it is a new job id and does not modify the original job.
- At most two analysis jobs run concurrently per domain and two globally. Admission failure returns `ContestAnalysisCapacityError` (HTTP 409). An existing pending or running job never blocks a new request unless the capacity is exhausted.

Example requests:

```http
POST /d/school/contest/analysis
Accept: application/json
Content-Type: application/json

{ "tids": ["665f00000000000000000001", "665f00000000000000000002"], "title": "提高组六场复盘", "includeStudents": true, "language": "zh" }
```

```http
GET /d/school/contest/analysis/4d548c56-28fc-4cf2-881c-a0f636466f59
Accept: application/json
```

## Response types

All dates are ISO-8601 strings. `progress` is an integer percentage in `[0, 100]`.

```ts
type ContestAnalysisOverview = {
  enabled: boolean;
  profiles: { id: string; label: string; model: string }[];
  defaultProfileId: string;
  jobs: ContestAnalysisJobSummary[];
};

type ContestAnalysisJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type ContestAnalysisStage =
  | 'waiting' | 'preparing' | 'overview' | 'students' | 'finalizing'
  | 'done' | 'failed' | 'cancelled' | 'timed_out';

type ContestAnalysisEvent = {
  seq: number;
  type: 'stage' | 'tool' | 'agent' | 'info';
  state: 'running' | 'succeeded' | 'failed';
  label: string; // English fallback for clients that do not translate `code`
  code?: string; // machine key: prepare, overview, overview_retry, student_batch, finalize, tool
  params?: Record<string, string | number>; // interpolation values for the code
  detail?: string; // tool argument or error summary
  tool?: string; // tool name for `type: 'tool'` events
  startedAt: string;
  finishedAt?: string;
};

type ContestAnalysisJobSummary = {
  jobId: string;
  status: ContestAnalysisJobStatus;
  stage: ContestAnalysisStage;
  progress: number;
  createdAt: string;
  finishedAt?: string;
  model?: string;
  title: string;
  contestCount: number;
  studentCount: number;
  error?: string;
};

type ContestAnalysisJob = ContestAnalysisJobSummary & {
  scope?: ContestAnalysisScopeSummary;
  events: ContestAnalysisEvent[]; // newest events are appended; the list keeps the latest 600 entries
  result?: ContestAnalysisResult; // present only when completed
};

type ContestAnalysisScopeSummary = {
  title: string;
  contests: { tid: string; title: string; beginAt: string; problemCount: number; participantCount: number }[];
  problemCount: number;
  studentCount: number;
};

type ContestAnalysisResult = {
  snapshot: ContestAnalysisSnapshot;
  report: ContestAnalysisReport;
};
```

`error` is present on `failed` and `cancelled` jobs. A job that exceeds the one-hour limit is reported as `failed` with `stage: 'timed_out'`. Completed and failed jobs are retained for 30 days.

### Snapshot

The snapshot is computed by the server from the contest scoreboards and problem metadata; it is deterministic and independent of the model. Scores use the contest's per-problem score weights, `maxScore` defaults to 100, and only submissions recorded in the contest journal count.

```ts
type ContestAnalysisProblemFact = {
  pid: number;
  title: string;
  difficulty: number; // 0 when the problem has no difficulty
  tags: string[];
  maxScore: number;
  submissionCount: number;
  attemptCount: number; // participants with at least one in-contest submission
  acceptCount: number; // participants with a full score
  averageScore: number;
  scoreBuckets: number[]; // 11 buckets, 0-10%, ..., 100%
};

type ContestAnalysisContestFact = {
  tid: string;
  title: string;
  rule: string;
  beginAt: string;
  endAt: string;
  durationMs: number;
  registeredCount: number;
  participantCount: number; // attended and ranked participants
  problems: ContestAnalysisProblemFact[];
  difficultyGradient: number[];
  tagOverlap: { tag: string; pids: number[] }[]; // tags used by two or more problems
  scoreStats: { count: number; mean: number; median: number; max: number; min: number; buckets: number[] }; // 50-point buckets
};

type ContestAnalysisTagStat = {
  tag: string;
  problemCount: number;
  contestCount: number;
  attemptCount: number; // participant x problem pairs
  studentCount: number;
  solveCount: number;
  solveRate: number; // 0..1
  scoreRate: number; // average percentage of the achievable score
  problems: { tid: string; pid: number; title: string; difficulty: number; solveRate: number }[];
};

type ContestAnalysisStudentFact = {
  uid: number;
  uname: string;
  displayName: string;
  realName?: string; // only when the domain stores one for the participant
  contests: ContestAnalysisStudentContestResult[];
  totals: {
    score: number; maxScore: number; contestCount: number; attendedCount: number;
    solvedCount: number; problemCount: number; averageScore: number; medianRank: number;
  };
  tags: { tag: string; attempted: number; solved: number; partial: number; failed: number }[];
};

type ContestAnalysisStudentContestResult = {
  tid: string;
  title: string;
  score: number;
  maxScore: number;
  rank: number; // 0 for unranked participants
  participantCount: number;
  solved: number[]; // pids with a full score
  problems: ContestAnalysisProblemResult[];
};

type ContestAnalysisProblemResult = {
  pid: number;
  title: string;
  difficulty: number;
  tags: string[];
  score: number;
  maxScore: number;
  accepted: boolean;
  attempts: number;
  wrongAttempts: number;
  firstScore?: number;
};
```

### Report

The report is written by the configured model and then normalized by the server: unknown contest/problem ids, missing contests, missing students in a batch, and empty required fields are rejected, text is trimmed to length limits, and unknown `severity`/`level` values fall back to `medium`/`average`.

```ts
type ContestAnalysisReport = {
  version: 1;
  overview: {
    summary: string; // Markdown
    keywords: string[];
    weakPoints: {
      tag: string;
      severity: 'high' | 'medium' | 'low';
      summary: string;
      evidence: string;
      contests: string[]; // contest titles
      advice: string;
    }[];
    difficultyComment: string;
    balanceComment: string;
    highlights: string[];
    recommendations: string[];
  };
  contests: {
    tid: string;
    summary: string;
    difficultyComment: string;
    balanceComment: string;
    problemComments: { pid: number; comment: string }[];
  }[];
  students: {
    uid: number;
    level: 'excellent' | 'good' | 'average' | 'weak' | 'at_risk';
    summary: string;
    strengths: string[];
    weaknesses: string[];
    recurringIssues: { issue: string; evidence: string; advice: string }[];
    focusTags: string[];
    contestComments: { tid: string; comment: string }[];
    actionPlan: string[];
  }[];
};
```

## Job lifecycle and agent behaviour

1. `waiting` – the job is admitted with the selected scope; `GET` returns the scope immediately.
2. `preparing` – the server builds the snapshot from scoreboards, problem metadata, participants and tags. Failures (missing contests, participant limits, snapshot problems) end the job with `stage: 'failed'`.
3. `overview` – an agent turn reads the snapshot through read-only tools (`get_scope_overview`, `list_contests`, `get_contest`, `list_problems`, `get_tag_statistics`, `list_students`, `get_student`, `search_students`) and submits the group overview and per-contest reviews. Invalid submissions are retried up to three times with the validation message.
4. `students` – when `includeStudents` is true, the participants are processed in batches of six; every batch must submit one report per student in that batch, with the same three-attempt validation. `progress` advances with the batches and each batch appends an `agent` event that lists the uids it covered.
5. `finalizing` – the group and per-student reports are merged, size-checked and stored as the job result.
6. `done` – `progress` is 100 and `result` is returned.

The agent never receives write access to platform data: the read-only tools expose the snapshot only, and the submission tools store the report on the job. Tool calls and turn boundaries are appended to `events`, newest last, so a client can poll `GET /contest/analysis/:aid` every few seconds and render progress.

Image export and other contest endpoints are unaffected by analysis jobs.
