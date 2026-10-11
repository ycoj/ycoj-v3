# Contest route reference

This is the implementation-backed route index; operation names are request-body dispatch names.

| Route | Handler result |
|---|---|
| `GET /contest` | HTML `contest_main.html`; filters `rule`, `group`, `page`, `q`. |
| `GET/POST /contest/create` | Edit HTML; POST update returns `{tid}` and redirects to detail. |
| `GET/POST /contest/:tid` | Detail HTML with a compact solution table for authorized users; `attend`, `subscribe`, `earlyEnd` operations. |
| `GET/POST /contest/:tid/solution/create` | Manager create form; POST `{title,content}` redirects to the new solution. |
| `GET/POST /contest/:tid/solution/:sid` | Solution HTML; manager `delete` operation. |
| `GET/POST /contest/:tid/solution/:sid/edit` | Manager edit form; POST `{title,content}` or `delete`. |
| `GET /contest/:tid/problems` | Problem list HTML/PJAX; clarification POST operation. |
| `GET/POST /contest/:tid/edit` | Edit/delete; same validated fields as create. |
| `GET/POST /contest/:tid/print`, `/api/printing/team` | Print HTML or `{success,output}`; print-task operations. |
| `GET/POST /contest/:tid/management` | Management HTML with full problem documents; file and score operations. |
| `GET/POST /contest/:tid/plagiarism` | JSON after contest end; owners/maintainers require `PERM_EDIT_CONTEST_SELF`, non-owners require `PERM_EDIT_CONTEST`. Latest task or HTTP 202 admission with `{method?: 'tree-sitter' \| 'heuristic'}` (Tree-sitter by default). Jobs/reports return their method; active tasks keep their original method. See [plagiarism.md](plagiarism.md). |
| `GET /contest/:tid/plagiarism/:jobId` | Same permission checks; asynchronous task progress/report JSON, scoped to contest/domain, with the 100 largest matching regions per pair in source order. |
| `GET /contest/:tid/plagiarism/:jobId/source/:rid` | Same permission checks; immutable analyzed C++ source snapshot for a completed task. |
| `GET/POST /contest/:tid/bulk-submit` | Bulk-submit HTML; POST zip of contestant C++ sources (see [bulk-submit.md](bulk-submit.md)). |
| `GET/POST /contest/:tid/clarification` | Clarification HTML; clarification operation. |
| `GET /contest/:tid/code` | Code view HTML (`all` filter). |
| `GET /contest/:tid/file/:type/:filename` | Signed-download redirect; `type` public/private. |
| `GET/POST /contest/:tid/user` | User management model; add/rank/resume/remove operations. |
| `GET/POST /contest/:tid/balloon` | Balloon HTML; setColor/done operations. |
| `GET/POST /contest/:tid/scoreboard[/:view]` | Scoreboard HTML; unlock operation. |

Decorated parameters and permission checks are documented in [README.md](./README.md). Ordinary GET responses are HTML unless a PJAX/JSON request asks for the handler body. Plagiarism routes and scoreboard export data return JSON directly; uploads are multipart and downloads are binary redirects.

`GET /contest/:tid/scoreboard/export-data?details=true` returns authorized image export JSON; see [contract](endpoints.md#image-export-data).
