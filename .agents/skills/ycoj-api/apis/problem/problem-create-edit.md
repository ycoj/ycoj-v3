# GET/POST `/problem/create` — create a problem

## Description

Displays the create page or creates a problem. Requires `PERM_CREATE_PROBLEM`. Files already uploaded to the user's temporary file area and referenced as `file://name.ext` in the statement are moved to the new problem's additional files.

## Request format

```ts
type CreateBody = { title: string; content: string; pid?: string | number; hidden: boolean; difficulty?: 0|1|2|3|4|5|6|7|8; tag?: string };
```

`pid` must match an optional 1–10-character alphanumeric namespace plus `-`, followed by a letter and alphanumerics; numeric values become `P{n}`. `tag` is comma-separated (Chinese commas are accepted).

POST creation also applies `problem_create` rate limiting keyed by user ID (across domains), defaulting to 2 attempts per 5-second window. The `limit.problem_create` system setting can override the count; `PRIV_UNLIMITED_ACCESS` and the existing ignored-limit configuration bypass it. The counter runs before duplicate-PID checks and problem/file writes, so a failed later creation attempt still consumes a slot. GET and edit do not use this dedicated limit.

```http
POST /problem/create HTTP/1.1
Accept: application/json
Content-Type: application/json
Cookie: sid=…

{"title":"A + B","content":"## Description\nCompute A+B.","pid":"P1000","hidden":true,"difficulty":1,"tag":"math,beginner"}
```

## Response format

```ts
type CreateResponse = { pid: string | number; url: string };
```

```json
{"pid":"P1000","url":"/p/P1000/files"}
```

An exhausted creation limit returns HTTP 403, with no problem or files created by that rejected request. Error response type: `type RateLimitError = { error: { message: string; params: ["problem_create", number, number]; stack?: string } }`. For a third POST within the same default window, representative JSON is:

```json
{"error":{"message":"Too frequent operations of {0} (limit: {2} operations in {1} seconds).","params":["problem_create",5,2],"stack":""}}
```

GET renders `problem_edit.html`; its representative JSON body is `{ "page_name":"problem_create", "additional_file":[] }` (statement-language data assigned immediately before is overwritten by the handler).

# GET/POST `/p/:pid/edit` and GET `/p/:pid/config`

## Description

Edit a problem statement/metadata or render its configuration page. The caller must own the problem with `PERM_EDIT_PROBLEM_SELF` or hold `PERM_EDIT_PROBLEM`. Config viewing rejects referenced problems.

## Request format

```ts
type EditPath = { pid: string | number };
type EditBody = { title: string; content: string; pid?: string | number; hidden: boolean; tag?: string; difficulty?: 0|1|2|3|4|5|6|7|8 };
```

```http
POST /p/P1000/edit HTTP/1.1
Accept: application/json
Content-Type: application/json
Cookie: sid=…

{"title":"A + B (revised)","content":"## Description\n…","pid":"P1000","hidden":false,"tag":"math","difficulty":1}
```

## Response format

```ts
type EditResponse = { url: string }; // under Accept: application/json
type ConfigPage = { testdata: FileMeta[]; config: string; pdoc: ProblemDoc; /* inherited detail fields */ };
```

```http
{"url":"/p/P1000"}
```

GET edit renders `problem_edit.html` with sorted `additional_file` and statement languages; a representative body is `{ "pdoc":{"pid":"P1000"},"additional_file":[],"statementLangs":["en"] }`. GET config renders `problem_config.html`; representative body: `{ "pdoc":{"pid":"P1000"},"testdata":[{"name":"config.yaml","size":42}],"config":"time: 1s\n" }`. Its `config` is empty if that file cannot be read.
