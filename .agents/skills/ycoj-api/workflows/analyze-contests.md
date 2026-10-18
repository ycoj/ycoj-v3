# Analyze multiple contests with the AI agent

Use this workflow when a coach or administrator wants one AI review of the class across several finished contests.

## Preconditions

- The account manages every contest it wants to analyse (owner/maintainer with `PERM_EDIT_CONTEST_SELF`, or `PERM_EDIT_CONTEST`).
- Every contest has ended (`contest.isDone`) and its scoreboard is visible to the caller.
- Contest analysis is enabled (`contestAnalysis.enabled`, falling back to `aiGeneration.enabled`) and a model is selected for contest analysis in the AI provider configuration.

## Steps

1. Resolve the contest ids. `GET /contest?q=...` lists visible contests with `docId`, `title`, `beginAt`, `endAt`, `rule`, `attend` and `pids`; keep one to twelve finished contests that the account manages.
2. Check availability and pick a model: `GET /contest/analysis`. The response returns `enabled`, `profiles` and `defaultProfileId`. When `enabled` is `false`, stop and report that an administrator must enable the feature or configure a model.
3. Create the job: `POST /contest/analysis` with `{ tids, title?, instructions?, includeStudents?, profileId?, language? }`. Expect HTTP 202 `{ jobId }`. Do not retry a request that timed out until you have read the job list, because a retry would create a second job.
4. Poll `GET /contest/analysis/:aid` every few seconds. Track `status`, `stage`, `progress` and `events`; `preparing` reads the scoreboards, `overview` writes the group review, `students` writes the per-student batches, and `finalizing` merges the report.
5. Stop when `status` is `completed`, `failed` or `cancelled`.
   - `completed`: `result.snapshot` holds problem statements and the deterministic numbers (contest, problem, participant, tag statistics) and `result.report` the AI text (`overview`, `contests`, `students`). Missing tags/difficulty can be inferred from statements in the AI text; the snapshot retains supplied metadata only.
   - `failed`: read `error` and `stage`. `timed_out` means the one-hour limit was reached; reduce the number of contests or participants and retry.
   - `cancelled`: the job was cancelled; `retry` creates a new job with the same scope.
6. Optional operations: `POST /contest/analysis/:aid` with `{ operation: "cancel" }` while pending/running, `{ operation: "delete" }` to remove the job, or `{ operation: "retry" }` to run the same scope again (HTTP 202 with a new `jobId`).

## Verification

- Confirm `GET /contest/analysis` lists the new job with the expected `contestCount`/`studentCount` and that the detail response has `canManage: true`.
- Verify the completed report references only the analyzed contests and problems, and that `result.report.students` covers every uid in `result.snapshot.students` when `includeStudents` was not disabled.
- For problems without tags or difficulty, verify that the report identifies statement-based judgments as inferred/estimated (or acknowledges insufficient information); do not treat these as stored metadata or precomputed tag statistics.
- Completed jobs are retained for 30 days; re-reading a job after that returns 404 `NotFoundError`.

## Failure handling

- `ContestNotEndedError` or `ContestScoreboardHiddenError`: remove the unfinished or hidden contest from the selection.
- `ValidationError` on `tids`: 1-12 distinct ids are required; unknown ids raise `ContestNotFoundError`.
- `ContestAnalysisCapacityError` (409): two jobs already run for this domain or globally; wait for one to finish.
- `ContestAnalysisUnavailableError` (503): the feature flag or model configuration is missing; an administrator must fix it.
