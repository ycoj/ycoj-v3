# Wallet, tasks, shop, and equipment

## `GET /rewards`

Request type: `type RewardsQuery = {}`. Example: `GET /rewards` with `Accept: application/json`.

Requires `PRIV_USER_PROFILE`; normal domain/account/real-name access checks still apply. The first read or mutation lazily creates the account's global wallet with 100 welcome coins, once, including for existing accounts. GET computes progress from current persisted check-in and submission records; it never claims task rewards automatically.

Response type (HTTP 200, JSON):

```ts
type Slot = 'frame' | 'background' | 'title' | 'accent';
type TaskId = 'checkin' | 'first-solve' | 'three-solves' | 'comeback' | 'practice-days' | 'eight-solves';
type Equipment = Partial<Record<Slot, string>>;
type RewardsData = {
  date: string; // YYYY-MM-DD in Asia/Shanghai
  week: string; // Monday, YYYY-MM-DD in Asia/Shanghai
  timezone: 'Asia/Shanghai';
  wallet: {
    balance: number;
    earned: number; // Includes welcome coins
    spent: number;
    owned: string[];
    equipped: Equipment;
    ledger: {
      id: string;
      reason: 'welcome' | 'admin-adjust' | 'cosmetics-refund' | TaskId | string;
      amount: number;
      at: string;
      by?: number;
      byName?: string;
      note?: string;
    }[];
  };
  tasks: {
    id: TaskId;
    period: 'daily' | 'weekly';
    target: number;
    coins: number;
    key: string; // `${periodStart}:${id}`
    progress: number; // Capped at target
    claimed: boolean;
  }[];
  catalog: { id: string; slot: Slot; price: number }[];
};
```

Example wallet excerpt (the actual response includes every task and catalog item listed below):

```json
{
  "date": "2026-11-02",
  "week": "2026-11-02",
  "timezone": "Asia/Shanghai",
  "wallet": {
    "balance": 100,
    "earned": 100,
    "spent": 0,
    "owned": [],
    "equipped": {},
    "ledger": [{ "id": "welcome", "reason": "welcome", "amount": 100, "at": "2026-11-02T04:00:00.000Z" }]
  },
  "tasks": [{ "id": "checkin", "period": "daily", "target": 1, "coins": 5, "key": "2026-11-02:checkin", "progress": 0, "claimed": false }],
  "catalog": [{ "id": "frame-tiger", "slot": "frame", "price": 200 }]
}
```

Tasks reset at UTC+8 midnight, weekly on Monday. No streak requirement or missed-day penalty. Rewards stack; maximum daily task payout is 50 coins and weekly task payout is 100 coins. Unclaimed tasks expire at their period boundary; there is no historical claim API.

| ID | Period | Target | Coins | Verified progress |
| --- | --- | --- | --- | --- |
| `checkin` | daily | 1 | 5 | Existing global check-in record for today |
| `first-solve` | daily | 1 | 15 | First lifetime accepted submission on a new problem today |
| `three-solves` | daily | 3 | 20 | Three distinct new problems today |
| `comeback` | daily | 1 | 10 | First lifetime pass today, with a WA/TLE/MLE/OLE/RE/CE submission before that first pass |
| `practice-days` | weekly | 3 | 40 | Three distinct days with at least one first lifetime pass each |
| `eight-solves` | weekly | 8 | 60 | Eight distinct new problems this week |

Submission dates use ObjectId creation timestamps, not judging completion time. Pending submissions do not count. Historical accepted records are consulted before applying period boundaries, so previously passed problems do not become new again. Problem references are resolved using persisted problem documents and grouped by canonical domain/problem ID, including records without a `source` field. Contest/homework submissions count only when the persisted event has ended (`endAt <= now`) and does not have `keepScoreboardHidden:true`; missing events are excluded. This prevents coin progress from leaking live or hidden verdicts. They retain their original submission dates, so daily claims may already have expired when the event ends. Normal programming-paper submissions may count. Pretest/generate sentinel contests and hacks are excluded. Rejudged first accepted records do not yield new progress. Failure after acceptance is not a comeback. Rewards cannot verify the originality of a student's code; there is no plagiarism reward or penalty.

## `POST /rewards`

Requires `PRIV_USER_PROFILE`. Rate limit: 60 mutation requests per 60 seconds per authenticated user. Send `Content-Type: application/json`.

```ts
type RewardsInput = {
  action: 'claim' | 'buy' | 'equip' | 'unequip';
  id: string;
};
```

There is no `operation` field. Examples:

```json
{ "action": "claim", "id": "first-solve" }
```

```json
{ "action": "buy", "id": "accent-forest" }
```

```json
{ "action": "equip", "id": "accent-forest" }
```

```json
{ "action": "unequip", "id": "frame" }
```

- `claim`: `id` must be a task ID. Computes progress again on the server. Only current daily/weekly tasks can be claimed, once per task and period. Repeating a successful claim is a no-op.
- `buy`: `id` must be a current catalog item ID. Deducts its fixed server price, adds permanent ownership, and adds a negative ledger entry atomically. Already-owned purchases are no-ops. Buying does not equip. Retired item IDs are rejected with `invalid-item`. Purchases still require a sufficient balance. Domain administrators adjust balances through [`POST /domain/coins`](../domain/coins.md), which is separate from this shop.
- `equip`: `id` must identify an owned catalog item. Replaces only that item's slot. Does not change balance or ledger.
- `unequip`: `id` must be a slot ID. Clears that slot without removing ownership or refunding coins. Repeating it is harmless.

Wallet replacement uses an `_id`/version compare-and-swap. Initial grants, balance, ownership, claim deduplication, equipment, aggregate totals, and ledger are in one MongoDB document, so no replica-set transactions are required. Claims older than the current day/week are pruned on mutation. The newest 100 ledger entries are retained, while earned/spent totals and permanent ownership remain. Contention retries recompute claims and check for midnight changes.

Success response is HTTP 200 JSON `RewardsData`, same type and example as GET. A fresh wallet has 100 coins, and every current catalog item costs 160 or 200, so the first purchase happens only after more coins are earned. After buying `accent-forest` from a wallet whose balance is 260, its wallet portion is:

```json
{
  "balance": 100,
  "earned": 260,
  "spent": 160,
  "owned": ["accent-forest"],
  "equipped": {},
  "ledger": [
    { "id": "buy:accent-forest", "reason": "accent-forest", "amount": -160, "at": "2026-11-02T04:01:00.000Z" },
    { "id": "welcome", "reason": "welcome", "amount": 100, "at": "2026-11-02T04:00:00.000Z" }
  ]
}
```

An administrator adjustment adds a ledger entry `{ "id": "adjust:<requestId>:<uid>", "reason": "admin-adjust", "amount": 20, "at": "2026-11-02T04:02:00.000Z", "by": 2, "byName": "coach", "note": "Class prize" }`. A cosmetics retirement refund adds `{ "id": "retire:<item-id>", "reason": "cosmetics-refund", "amount": 60, "note": "<item-id>" }`. The newest 100 entries are kept, so those optional fields can age out of the response.

Invalid task/item/slot, incomplete task, insufficient balance, and unowned equipment return HTTP 400 with `type RewardFailure = {error:{name:'RewardError';message:string}}`. Message codes are `invalid-task`, `invalid-item`, `task-incomplete`, `insufficient-coins`, and `item-not-owned`. Example: `{"error":{"name":"RewardError","message":"insufficient-coins"}}`. Exhausted concurrency retries return HTTP 409 with message `busy`. Invalid `action`/missing or invalid typed fields use the normal validation error envelope. Authentication, privilege, real-name, and rate limit failures retain existing framework envelopes/status behavior. No redirects are introduced by this handler.

Catalog:

| ID | Slot | Price |
| --- | --- | --- |
| `frame-tiger` | frame | 200 |
| `frame-pixel` | frame | 200 |
| `accent-forest` | accent | 160 |
| `accent-violet` | accent | 160 |

Retired and no longer sold: `frame-sprout` (frame, 60), `frame-starlight` (frame, 180), `background-sky` (background, 120), `background-peach` (background, 120), `title-explorer` (title, 80), and `title-persistent` (title, 240). Those were the solid-color avatar frames, every name background, and every personal title. Decorated frames and interface accent colors stay. The `retireCosmetics` CLI refunds owners once, unequips the retired slots, and sends one in-site message. Preview with `hydrooj cli script retireCosmetics '{"dryRun":true}'` and apply with `hydrooj cli script retireCosmetics '{"confirm":true}'`. A second apply does not refund again. Do not run the apply against a production database unless that refund is intended.

Names and visual styles are localized by the frontend, not arbitrary HTML or CSS supplied by the client. Equipment affects cosmetics only, not scores, Rating, RP, or permissions.

## Public user appearance

User serialization and public user dictionaries expose only `rewardEquipment?:Equipment`; they do not expose another user's wallet balance, inventory, claims, or ledger. Example user excerpt: `{"_id":12,"uname":"alice","rewardEquipment":{"frame":"frame-tiger","accent":"accent-forest"}}`. `GET /user/:uid` includes it under `udoc`, and `/ui/nav` includes it in the authenticated `user`. User-list projections use a batch wallet lookup. Equip/unequip invalidates the affected user's cross-process cache. Defaults apply when the field or a slot is absent.
