# Preliminary Round Training endpoints

## Shared types

```ts
type SectionType = 'single_choice' | 'program_reading' | 'program_completion' | 'programming';
type QuestionType = 'choice' | 'true_false' | 'programming';

interface ChoiceOption { id: string; text: string }
interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  score: number; // multiple of 0.5, between 0.5 and 1000
  explanation: string;
  answer: string; // option id, or "true" / "false"
  options?: ChoiceOption[];
  pid?: number;
  problemTitle?: string;
  multiplier?: number;
  languages?: string[];
}
interface Section {
  id: string;
  type: SectionType;
  title: string;
  content: string;
  questions: Question[];
}
interface PaperDefinition { title: string; content: string; sections: Section[] }

// Draft-input shape for save requests: normalization fills omitted fields,
// and every normalized stored Question carries a (possibly empty) explanation.
interface BaseQuestionInput {
  id: string;
  prompt: string;
  score: number; // multiple of 0.5, between 0.5 and 1000
  explanation?: string;
}
interface ObjectiveQuestionInput extends BaseQuestionInput {
  type: 'choice' | 'true_false';
  answer: string; // option id, or "true" / "false"
  options?: ChoiceOption[];
}
interface ProgrammingQuestionInput extends BaseQuestionInput {
  type: 'programming';
  pid?: number;
  problemTitle?: string;
  multiplier?: number;
  languages?: string[];
}
type QuestionInput = ObjectiveQuestionInput | ProgrammingQuestionInput;
interface SectionInput { id: string; type: SectionType; title: string; content: string; questions: QuestionInput[] }
interface PaperDefinitionInput { title: string; content: string; sections: SectionInput[] }
type Answers = Record<string, string>;
type ProgrammingAnswer = { lang: string; code: string };
```

IDs use 1-64 ASCII letters, digits, `_`, or `-` and must be unique across sections and questions; option IDs must be unique within their question. A paper has at most 100 sections and 200 questions. Question scores are multiples of 0.5 from 0.5 to 1000, so totals remain exact. Programming questions reference an existing problem, use a positive multiplier, and optionally restrict languages; an empty restriction inherits all languages allowed by the referenced problem. Choice questions have at most 26 options. Only program-reading sections accept true/false questions. Programming sections accept only programming questions; legacy sections containing programming questions remain valid. Publishing additionally requires nonempty section titles, program passages for reading/completion sections, question prompts, at least two options per choice question, and valid answer references. Explanations are optional in submitted definitions.

## `GET /preliminary`

Description: list visible papers or the current user's immutable attempt history. Draft visibility follows edit ownership. Query `type Query={page?:PositiveInt;q?:string;view?:"papers"|"attempts"}`. Guests cannot select personal history.

Paper response:

```ts
type Response = {
  view: 'papers';
  papers: Array<{
    docId: ObjectId; owner: number; title: string; content: string;
    published: boolean; revision: number; nAttempt: number; updatedAt: Date;
    questionCount: number; totalScore: number;
  }>;
  page: number; pcount: number; q: string;
};
```

Example: `GET /preliminary?page=1&q=CSP` -> `{"view":"papers","papers":[],"page":1,"pcount":0,"q":"CSP"}`.

Attempt-history response uses `view:"attempts"` and `attempts:Array<{docId,paperId,revision,title,score,totalScore,submittedAt}>`; `q` is empty. Example: `GET /preliminary?view=attempts` -> `{"view":"attempts","attempts":[],"page":1,"pcount":0,"q":""}`.

## `GET /preliminary/import`

Description: search independent objective problems the caller can view and edit. Requires both `PERM_CREATE_PROBLEM` and `PERM_VIEW_PROBLEM`. Edit access is owner/maintainer with `PERM_EDIT_PROBLEM_SELF`, or `PERM_EDIT_PROBLEM`. Results never expose raw configuration or standard answers. Referenced problems are excluded.

Request `type Query={q?:string}`. A trimmed, case-insensitive literal query matches title or PID; numeric queries also match document ID. Empty queries list the first eligible problems. At most 20 matches are returned in problem sort order; there is no pagination.

Response `type Response={pdocs:Array<{docId:number;pid?:string;title:string}>}`.

Example: `GET /preliminary/import?q=CSP` -> `{"pdocs":[{"docId":1001,"pid":"P1001","title":"CSP-J 2025"}]}`. A caller without source edit permissions gets `{"pdocs":[]}`.

## `POST /preliminary/import` operation `import`

Description: convert a visible, editable Markdown objective problem into a new unpublished preliminary paper owned by the caller. Requires `PERM_CREATE_PROBLEM` + `PERM_VIEW_PROBLEM` and the same source edit access as the search endpoint. Unauthorized or missing source problems fail before reading answers into a paper. Hidden-source visibility is checked separately from edit permission. Referenced and HTML problems are rejected. Rate limit: 10 conversions per 60 seconds per user.

Request `type Request={operation:"import";pid:number|string}`; `pid` accepts a numeric document ID or problem PID.

Example: `{"operation":"import","pid":1001}`.

Response `type Response={paperId:ObjectId;url:string}`. Example: `{"paperId":"68b6a37c02f364f625239e11","url":"/preliminary/68b6a37c02f364f625239e11/edit"}`. Browser negotiation redirects to the edit page; domain-scoped URLs may contain `/d/:domainId`.

Conversion supports `{{ select(id) }}` followed immediately (apart from blank lines) by an unordered Markdown option list, and `{{ dropdown(id)[value1,value2] }}`. Each question must have exactly one answer and score pair in raw `config.answers`: `["B",2]` for select, or `["value2",2]` for dropdown. IDs support numeric and `number-number` forms. The result has one `single_choice` section with stable `q-<sourceId>` question IDs, preserves source question order, Markdown prompts/options, answers, and scores, and uses all ordinary complete-paper validation limits. Shared program passages stay in question prompts. Fenced and indented code blocks are preserved. Trailing text is retained in the last prompt. Source `file://` references become `/api/d/:domainId/p/:docId/file/...` URLs and continue to depend on source file access. Multilingual statements select the user's view language, then `zh`, then `en`, then the first statement.

Unsupported text/multiselect controls, repeated IDs, unmatched answers, malformed option lists, alternative-answer scoring, invalid scores, and other invalid definitions fail with `ValidationError` before any paper is created. Missing/inaccessible sources produce `ProblemNotFoundError`; insufficient edit permission produces the ordinary permission error. Source problems and submission records remain unchanged, explanations start empty, no revision is published, and no attempt is created.

Workflow: search -> select a result -> POST `import` -> open returned edit URL -> review/correct the draft -> save or publish using the existing `save` operation. A failed conversion must not continue to publishing. Search results can contain unsupported question formats; conversion is the authoritative validation step.

## `GET /preliminary/:paperId`

Description: render a published paper or an authorized draft preview. Response `type Response={paper:PublicPaper;pdict:Record<number,ProblemDoc>;attempts:AttemptSummary[];owner:User;canEdit:boolean;canSubmit:boolean}`. `pdict` contains each accessible programming problem referenced by the paper, keyed by numeric problem document ID, using the public problem projection (including its statement and judge configuration); inaccessible or missing problems are omitted, and it is empty when the paper has no programming questions. `PublicPaper.sections[].questions[]` includes the prompt, type, score, and options but never includes `answer` or `explanation`. The attempt list contains at most the current user's latest 20 attempts.

Example: `GET /preliminary/68b6...` -> `{"paper":{"docId":"68b6...","title":"CSP-J 2025","revision":2,"sections":[]},"pdict":{"1001":{"docId":1001,"title":"A + B","content":"...","config":{"type":"default"}}},"attempts":[],"canEdit":false,"canSubmit":true}`. An unauthorized draft returns `PreliminaryPaperNotPublishedError`.

## `POST /preliminary/:paperId` operation `submit`

Description: grade and store one immutable attempt. Requires profile privilege and `PERM_SUBMIT_PROBLEM`; rate limit is 20 requests per 60 seconds per user. Each programming question may be submitted at most 30 times per user and paper revision (a soft check; concurrent requests are not reserved atomically). The paper must currently be published. `revision` may identify an older immutable revision the user loaded before an immediate paper update.

Request `type Request={operation:"submit";revision:PositiveInt;answers:Answers;programmingAnswers?:Record<string,ProgrammingAnswer>}`. Missing question keys are unanswered. Programming answers create normal problem records and keep the attempt `status:"pending"` until judging completes; an empty language restriction inherits the referenced problem languages, and the last record determines the score.

```json
{"operation":"submit","revision":2,"answers":{"q1":"option-b","q2":"true"}}
```

Response `type Response={attemptId:ObjectId;score:number;totalScore:number;url:string}`. Example: `{"attemptId":"68b7...","score":92,"totalScore":100,"url":"/preliminary/68b6.../attempt/68b7..."}`. Browser negotiation redirects to the result URL.

## `GET /preliminary/:paperId/attempt/:attemptId`

Description: return one result to its owner. Response `type Response={attempt:AttemptDoc;paper:ReviewPaper}`. Every review question contains `{result:{questionId,answer?,correct,score,maxScore,status?,rid?,lang?,judgeScore?}}`; programming results may remain pending until the linked record finishes. Only incorrect or unanswered objective questions additionally contain `correctAnswer`, and `explanation` when the question has one. Other users receive `PreliminaryAttemptNotFoundError`.

## `GET /preliminary/create` and `GET /preliminary/:paperId/edit`

Description: render the structured editor. Create requires `PERM_CREATE_PROBLEM`; edit requires ownership plus `PERM_EDIT_PROBLEM_SELF`, or `PERM_EDIT_PROBLEM`. Response `type Response={page_name:"preliminary_create"|"preliminary_edit";paper:PaperSummary|null;definition:PaperDefinition}`. Unlike public detail, the authorized editor definition includes answer keys and explanations.

## `POST /preliminary/create` and `POST /preliminary/:paperId/edit` operation `save`

Description: save a draft, publish, update a published paper immediately, or unpublish. Request `type Request={operation:"save";definition:PaperDefinitionInput;published:boolean}`. Normalization accepts the draft-input shape and stores the required normalized `Question` shape, filling omitted explanations with an empty string. Programming questions are linked by `pid`; their `prompt` and `problemTitle` may be omitted because the linked problem supplies the statement.

```json
{
  "operation":"save",
  "published":true,
  "definition":{"title":"CSP-J 2025","content":"Practice","sections":[]}
}
```

The example shape is syntactically valid but publication fails until it contains a complete section and question. A successful response is `type Response={paperId:ObjectId;url:string}` and redirects to `/preliminary/:paperId`. Every save with `published:true` creates and activates a new immutable revision; `published:false` creates or updates a draft without a revision.

## `POST /preliminary/:paperId` operation `delete`

Description: permanently delete the paper and all of its revision snapshots, attempts, and score history. Request `{"operation":"delete"}`. Requires the corresponding problem edit permission. Response redirects to `/preliminary`; JSON negotiation returns `{"url":"/preliminary"}`.
