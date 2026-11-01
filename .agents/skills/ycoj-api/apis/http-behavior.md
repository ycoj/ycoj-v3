# Shared HTTP response behavior

## Content negotiation and cache variation

For ordinary handler routes, request type is the endpoint's documented query/body plus `Accept?: string`. For example, `GET /p/P1000` with `Accept: application/json` returns the documented problem-detail JSON model, while a browser request normally renders its HTML template. Explicit file/binary and fixed-content-type endpoints keep their own response formats.

Response type remains the endpoint's documented model, HTML, binary, or redirect. Handler responses include `Vary: Accept`; this is combined with existing values such as `Origin`, `Referer`, and compression's `Accept-Encoding`, rather than replacing them. An illustrative response header is `Vary: Origin, Referer, Accept-Encoding, Accept`. Header ordering and case are not significant. Caches must not reuse an HTML representation for a JSON request or cross the existing origin/referer boundaries. Conditional 304 and redirect responses from handlers also carry the variation header. OPTIONS preflight ends before invoking a handler and retains its existing Origin/Referer variation.

## Nested aggregate errors

When a handler or framework error formatter receives a nonempty nested aggregate error, it recursively selects the first contained error before applying ordinary error classification. Request types and permissions are unchanged. A nested `ValidationError('pid')`, for example, retains the normal HTTP 403 user-facing status and error response instead of becoming an HTTP 500 wrapper error.

The handler JSON error response type is `type ErrorResponse = { error: { message: string; params?: unknown[]; stack?: string } }`; concrete serializers and error paths may omit fields. Representative request: `POST /problem/create` with its documented fields and `Accept: application/json`; representative validation response:

```json
{"error":{"message":"Field {0} validation failed.","params":["pid"],"stack":""}}
```

Empty aggregates remain aggregate errors. String errors retain ordinary string formatting. This change does not add or rename any route or operation.
