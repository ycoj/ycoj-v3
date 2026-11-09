# Game frames and themes

These are native-resolution Chromium captures of the actual rewards shop, avatar renderer, theme styles, and shared sidebar components. The sample account, robot avatar, wallet, and sidebar entries are test fixtures, labeled as a preview in each capture. No production account or wallet was changed.

- `desktop.png`: block forest and pixel explorer, 1440px viewport.
- `space.png`: space voyage and space navigator, 1440px viewport.
- `racing.png`: speed circuit and speed racer, 1440px viewport.
- `ocean.png`: sprite bay and sprite companion, 1440px viewport.
- `dark.png`: space voyage in dark mode, 1440px viewport.
- `mobile.png`: sprite bay and sprite companion, 390px viewport.

Regenerate from `ycoj-ui/`:

```sh
pnpm exec vitest run --config vitest.browser.config.mts --mode preview features/rewards/rewards-page.browser.test.tsx
```

Captures are written to `test-results/rewards-*.png`. Preview mode uses a larger outer browser viewport so Vitest does not scale down the rendered test iframe. The tests load the shipped Inter font and wait for every avatar and frame image before capture. Each committed PNG records its screenshot origin in its `Source` metadata.

The shipping frames and theme backgrounds are original SVG assets under `public/rewards/`. The five frames cost 200 coins each; the four themes cost 160 coins each. Existing forest/violet IDs and the `accent` equipment slot are retained.
