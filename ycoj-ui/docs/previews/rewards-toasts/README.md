# Rewards toast feedback

These are native-resolution Chromium captures of the actual rewards page after mocked wallet actions. The account, wallet, tasks, and catalog are fixtures; API responses are mocked. No production account or balance was changed.

- `success.png`: a 200-coin frame redemption confirmed by the mocked API. The balance drops to 200, the item becomes owned, and a success toast appears.
- `error.png`: a mocked `insufficient-coins` rejection. The error toast appears and the wallet stays unchanged.

Regenerate from `ycoj-ui/`:

```sh
pnpm exec vitest run --config vitest.browser.config.mts --mode preview features/rewards/rewards-page.browser.test.tsx
```

Captures are written to `test-results/rewards-toast-*.png`. The preview mounts the shared `Toaster` with a long duration so the toast remains visible for the capture. It renders at a 1280px viewport in light mode with the Chinese locale.
