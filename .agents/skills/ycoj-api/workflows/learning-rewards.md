# Earn and equip learning rewards

Use the authenticated account; do not send another user's ID. Read [the rewards contract](../apis/rewards/wallet.md) first.

1. `GET /rewards`, verify `date`, `week`, task progress, balance, and ownership. This lazily grants the initial 100 coins once.
2. For check-in, call `POST /checkin` with `{}` only when today's check-in is missing. Its existing external quote failure can prevent check-in; stop and show the error rather than inventing completion. Read `/rewards` again.
3. For a task whose progress reaches its target, `POST /rewards` with `{"action":"claim","id":"<task-id>"}`. Verify `claimed:true` and the matching positive ledger entry in the response. Claim before that day/week expires. Task IDs do not carry client-chosen dates.
4. Choose a catalog item, review its fixed price against the returned balance, then send `{"action":"buy","id":"<item-id>"}`. Stop on insufficient funds. Verify permanent ownership and the deduction. Retrying the same item does not charge twice.
5. Send `{"action":"equip","id":"<owned-item-id>"}`. Verify the returned `wallet.equipped` slot and refresh the frontend's user context. A subsequent `GET /user/:uid` or `/ui/nav` exposes only equipment, not private wallet data.
6. To restore a default, send `{"action":"unequip","id":"<slot>"}`. Verify that the slot is absent and ownership and balance remain intact.

After an uncertain mutation result, refresh `/rewards` before repeating. Do not issue a different purchase to recover an uncertain purchase. Claim and same-item purchase retries are idempotent. Stop on authentication, validation, permission, rate-limit, or unexpected response errors.
