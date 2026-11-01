# Learning rewards

- [Wallet, tasks, shop, and equipment](wallet.md): `GET|POST /rewards`.

Both methods require `PRIV_USER_PROFILE`. Wallets and task progress belong to the authenticated account globally, across domains. Never accept a client-supplied user ID, amount, price, progress, or ownership value. Send `Accept: application/json` and authenticate using the existing session or bearer token. Prefix `/d/{domainId}` only when needed for domain selection; it does not create a separate wallet.
