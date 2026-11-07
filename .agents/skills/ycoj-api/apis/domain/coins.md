# Domain coin adjustments

## `GET /domain/coins`

Description: confirm that the caller may adjust coins in the active domain. The page itself does not list balances.

Request type: `type Query = {}`. Example:

```http
GET /domain/coins HTTP/1.1
Accept: application/json
Cookie: sid=<sid>
```

Response type: `type Response = { domain: { _id: string; name: string } }`. Example:

```json
{ "domain": { "_id": "school", "name": "School" } }
```

Requires `PERM_EDIT_DOMAIN` in the active domain. A caller without it receives the normal permission error. `Cookie: sid=<sid>` or `Authorization: Bearer <sid>`.

## `POST /domain/coins`

Description: grant or deduct the same whole-coin amount for one or more users who have already joined the active domain. Each wallet is updated with a version compare-and-swap. The same `requestId` does not apply twice for the same user.

Request type:

```ts
type Adjust = {
  operation: 'adjust';
  uids: number[];
  direction: 'grant' | 'deduct';
  amount: number;
  reason: string;
  requestId: string;
};
```

Example:

```http
POST /domain/coins HTTP/1.1
Accept: application/json
Content-Type: application/json
Cookie: sid=<sid>

{
  "operation": "adjust",
  "uids": [12, 13],
  "direction": "deduct",
  "amount": 20,
  "reason": "Missed the weekly practice",
  "requestId": "request-22"
}
```

`uids` is a numeric array of 1 to 100 distinct account IDs, each at least 2. Every ID must already have `join: true` in this domain and a role other than `guest`; otherwise the whole request fails and no wallet changes. `amount` is an integer from 1 to 100000. `reason` is required, trimmed, and at most 200 characters. `requestId` matches `^[A-Za-z0-9_-]{8,80}$`.

Requires `PERM_EDIT_DOMAIN` and sudo. The handler also rate-limits the caller to 30 adjustments per 60 seconds. A deduction may make the balance negative so the recorded penalty matches the amount entered. The shop still refuses a purchase the member cannot afford.

Response type:

```ts
type Result = {
  adjustments: { uid: number; amount: number; balance: number; applied: boolean }[];
};
```

`amount` is positive for a grant and negative for a deduction. `applied` is false when that user's ledger already contains `adjust:<requestId>:<uid>`. Example:

```json
{
  "adjustments": [
    { "uid": 12, "amount": -20, "balance": -5, "applied": true },
    { "uid": 13, "amount": -20, "balance": 80, "applied": true }
  ]
}
```

Each applied change appends a ledger entry on the member's global wallet:

```json
{
  "id": "adjust:request-22:12",
  "reason": "admin-adjust",
  "amount": -20,
  "at": "2026-11-07T07:00:00.000Z",
  "by": 2,
  "byName": "coach",
  "note": "Missed the weekly practice"
}
```

The newest 100 ledger entries are retained. `earned` increases for a grant and `spent` increases by the absolute amount for a deduction. The member receives one unread in-site message from the system account. Grant text is `{0} granted you {1} coins in {2}. Reason: {3}`; deduction text is `{0} deducted {1} coins in {2}. Reason: {3}`. The parameters are the operator username, the positive amount, the domain name, and the reason. A repeated `requestId` does not send another message.

The handler writes an oplog entry `domain.coinAdjust` with `uids`, `direction`, `amount`, `requestId`, and `reason`.

Validation failures return HTTP 400 `{ "error": { "name": "RewardError", "message": "<code>" } }` with one of `invalid-users`, `invalid-amount`, `invalid-note`, `invalid-request`, or `user-not-in-domain`. A wallet that loses eight compare-and-swap attempts returns HTTP 409 with message `busy`. Users already adjusted in that request stay adjusted; retry the same `requestId` to finish the rest without doubling them. Missing fields and a wrong `direction` use the normal validation error envelope. Missing sudo redirects to `/user/sudo`. Permission and rate-limit failures keep the existing framework envelopes.
