# POST `/api/entity.preview` — lightweight hover preview

## Description

Query operation `entity.preview` returns a small summary for one problem, contest, homework, training, or user in the active domain. It exists for link hover cards. It does not load problem statements, testdata, judge configuration, contest or homework statements, training files, or the training description body. Training progress is the caller's already stored enrollment status. This operation does not recompute progress and does not write a training status document, so it does not use `GET /training/:tid`.

Missing documents and a contest requested as homework (or the reverse) raise the matching not-found error. Hidden problems are returned to the owner, a maintainer, or a caller with `PERM_VIEW_PROBLEM_HIDDEN`. Assigned contests and homework follow the same visibility rules as their detail pages: the owner, a maintainer, or the matching hidden-view permission skips the group check. Other callers must belong to one of the document's `assign` groups.

## Request format

```ts
type EntityPreviewArgs = {
  kind: 'problem' | 'contest' | 'homework' | 'training' | 'user';
  id: string; // problem pid or numeric docId; contest, homework, and training ids are 24-hex ObjectIds; user ids are decimal uids
};
```

```http
POST /api/entity.preview HTTP/1.1
Accept: application/json
Content-Type: application/json
Cookie: sid=…

{"args":{"kind":"problem","id":"P1000"}}
```

`id` is at most 128 characters and cannot contain a slash. The active domain comes from the request host or `/d/{domainId}` prefix. View permission for the kind is required: `PERM_VIEW_PROBLEM`, `PERM_VIEW_CONTEST`, `PERM_VIEW_HOMEWORK`, `PERM_VIEW_TRAINING`, or `PERM_VIEW` for a user.

## Response format

```ts
type ScheduleStatus = 'pending' | 'running' | 'ended';

type ProblemPreview = {
  kind: 'problem';
  id: string;
  pid: string;
  title: string;
  difficulty: number;
  tags: string[]; // at most three
  nAccept: number;
  nSubmit: number;
  hidden: boolean;
};

type ContestPreview = {
  kind: 'contest';
  id: string;
  title: string;
  rule: string;
  status: ScheduleStatus;
  beginAt: string; // ISO-8601
  endAt: string;
  attend: number;
  problemCount: number;
  rated: boolean;
};

type HomeworkPreview = {
  kind: 'homework';
  id: string;
  title: string;
  status: ScheduleStatus;
  deadline: string; // penaltySince when set, otherwise endAt
  attend: number;
  problemCount: number;
};

type TrainingPreview = {
  kind: 'training';
  id: string;
  title: string;
  excerpt: string; // collapsed summary, at most 140 characters
  sectionCount: number;
  problemCount: number;
  attend: number;
  enrolled: boolean;
  progress: number | null; // null when the caller is not enrolled
};

type UserPreviewEquipment = {
  frame?: string;
  background?: string;
  title?: string;
  accent?: string;
};

type UserPreview = {
  kind: 'user';
  id: string;
  uname: string;
  displayName: string | null; // only for the user or a caller with PERM_VIEW_USER_PRIVATE_INFO
  avatar: string;
  role: string | null; // omitted when the domain role is default
  badge: string | null;
  bio: string; // flattened excerpt, at most 140 characters
  nAccept: number;
  rating: number | null; // null without PERM_VIEW_CONTEST_SCOREBOARD or a published rating
  rank: number | null; // null when the user hides their rank
  ccfLevel: number;
  priv: number;
  equipment: UserPreviewEquipment; // equipped cosmetic ids only
};

type EntityPreview = ProblemPreview | ContestPreview | HomeworkPreview | TrainingPreview | UserPreview;
```

```json
{"kind":"problem","id":"P1000","pid":"P1000","title":"A + B","difficulty":1,"tags":["math"],"nAccept":12,"nSubmit":40,"hidden":false}
```

```json
{"kind":"contest","id":"665f00000000000000000001","title":"Weekly","rule":"oi","status":"pending","beginAt":"2026-09-01T02:00:00.000Z","endAt":"2026-09-01T06:00:00.000Z","attend":24,"problemCount":6,"rated":false}
```

```json
{"kind":"homework","id":"665f00000000000000000002","title":"Week 1","status":"running","deadline":"2026-09-08T15:59:00.000Z","attend":18,"problemCount":5}
```

```json
{"kind":"training","id":"665f00000000000000000003","title":"Dynamic Programming","excerpt":"Knapsack and LIS.","sectionCount":4,"problemCount":12,"attend":30,"enrolled":true,"progress":42}
```

```json
{"kind":"user","id":"12","uname":"alice","displayName":null,"avatar":"github:alice","role":"guest","badge":null,"bio":"Hello","nAccept":3,"rating":null,"rank":9,"ccfLevel":0,"priv":0,"equipment":{"frame":"frame-sprout"}}
```

A user preview does not read mail, sessions, the reward wallet balance or ledger, accepted-problem lists, or rating history. It uses the published rating summary and does not settle ratings. `displayName` is a private domain field.

Permission and assignment failures use the standard error envelope (`PermissionError`, `PrivilegeError`, or `NotAssignedError`). Unknown kinds and malformed ids use `ValidationError`.
