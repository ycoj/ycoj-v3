# Domain branding

## `GET /branding`

Public, including anonymous users, private domains and accounts blocked by real-name verification. Returns only the brand matching the supplied visiting origin. Does not change the active Hydro domain, permissions or session. Always JSON with `Cache-Control: no-store`.

Request type: `type Query = { origin: string }`. Example: `GET /branding?origin=https%3A%2F%2Foj.school.edu`.

Response type:
```ts
type Brand = { origin: string; name: string; logo: string };
type Response = { brand: Brand | null };
```

Example: `{"brand":{"origin":"https://oj.school.edu","name":"School OJ","logo":"https://cdn.school.edu/logo.png"}}`.

An unknown or malformed origin returns `{"brand":null}`. A missing `origin` fails parameter validation. Origins are normalized by the URL parser: protocol and hostname case and default ports are canonicalized; `/` is allowed. Matching includes protocol and non-default port. No wildcard or subdomain matching. The frontend uses its original `Host` and `X-Forwarded-Proto` to select a brand, with `SITE_NAME` and the existing theme logos as the fallback. Reverse proxies must preserve the visiting Host and set X-Forwarded-Proto to the original protocol.

## `GET /manage/branding`

Requires `PRIV_EDIT_SYSTEM` and a current sudo session. Request type: `type Query = {}`. Example: `GET /manage/branding` with `Accept: application/json` and a sid cookie.

Response type: `type Response = { config: { brands: Brand[] } }`. Example: `{"config":{"brands":[]}}`. Always JSON with `Cache-Control: no-store`. Without sudo, follows the normal sudo flow (`{"url":"/user/sudo"}` under JSON negotiation).

## `POST /manage/branding`

Requires `PRIV_EDIT_SYSTEM` and sudo. Replaces all brand entries atomically in the global `branding.config` system setting and broadcasts the update to workers. The new CORS allowlist is used on subsequent requests without a restart.

Request type: `type Input = { value: string }`, where value contains JSON of `type Config = { brands: Brand[] }`.

Example:
```json
{"value":"{\"brands\":[{\"origin\":\"https://oj.school.edu\",\"name\":\"School OJ\",\"logo\":\"https://cdn.school.edu/logo.png\"}]}"}
```

Response type: `type Response = { config: { brands: Brand[] } }`. Example: `{"config":{"brands":[{"origin":"https://oj.school.edu","name":"School OJ","logo":"https://cdn.school.edu/logo.png"}]}}`.

Validation: unique canonical HTTP(S) origins without credentials, paths (other than `/`), query or fragment; trimmed names of 1–100 UTF-16 code units; absolute HTTP(S) logo URLs without credentials. HTTPS brands require HTTPS logos. Logos must be publicly accessible. Invalid JSON or values raise `ValidationError('value')` before writing. An empty brands array removes all custom brands and their automatic CORS grants; independently configured server.cors entries remain.

## CORS and resources

Every saved brand origin is an exact CORS grant, including protocol and port. Existing comma-separated `server.cors` entries remain supported: bare host[:port] retains legacy matching across HTTP(S), and complete origins match exactly. `server.cors` changes are also applied without restarting. Unlisted origins get no CORS grant; CORS does not grant platform permissions.

Allowed requests receive `Access-Control-Allow-Origin` reflecting their exact Origin, `Access-Control-Allow-Credentials: true`, allowed methods `GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS`, and allowed headers `x-requested-with, accept, origin, content-type, upgrade-insecure-requests, authorization, range`. Response headers exposed to browser code are `Content-Disposition, Content-Length, Content-Range, Accept-Ranges, ETag, Location`. OPTIONS returns `ok` without invoking a handler. Responses vary on Origin and Referer, preserving other Vary values. A Referer without Origin can satisfy the existing trusted cross-origin POST check, but cannot emit an Allow-Origin header.

Frontend operations and uploads default to the visiting origin through `/api`, retaining same-origin session cookies. An explicit `NEXT_PUBLIC_UPLOAD_BASEURL` still opts into direct uploads and requires compatible backend cookie/SameSite and proxy configuration; CORS alone cannot override browser third-party cookie restrictions. The proxy request-body limit is 256 MB, matching the backend's default upload limit. LOGO requests use public image URLs directly, without Next image optimization or a fixed remote-host allowlist.
