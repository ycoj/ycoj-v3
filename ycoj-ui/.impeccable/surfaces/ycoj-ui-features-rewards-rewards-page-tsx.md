---
version: 1
slug: 'ycoj-ui-features-rewards-rewards-page-tsx'
primary_target: 'ycoj-ui/features/rewards/rewards-page.tsx'
related_targets: []
---

# Rewards shop extension

Mode: Operate. This extends the existing YCOJ learning rewards shop and app shell. The user approved four directions: block adventure, speed racing, space exploration, and sprite companions. Keep the existing product layout, task economy, localization, sidebar, and native controls. No new visual world or concept-seed is needed for this scoped extension.

THESIS: Students see recognizable game-inspired sticker frames and can combine a frame with a themed learning-space background before spending their earned coins. Avoid a shop of uninformative color swatches.

OWN-WORLD: Inherit the existing Inter typography, semantic shadcn surfaces, rounded 14px cards, sidebar and tabs. Frames carry the reference image's rounded-square silhouette, white sticker edging, and small friendly decorations, using original vector artwork. The four palettes are mint forest, lavender space, racing blue, and turquoise bay, with distinct quiet background scenery and light/dark surfaces.

STORY: Keep earning coins through the existing tasks, choose a frame and theme, inspect the combined appearance, redeem the selected item, then equip it. Previewing never changes balance or equipment. Existing purchases continue working.

FIRST VIEWPORT: Preserve the title, balance, tabs, shop heading and category filters. On desktop, five frame tiles sit in the main area with a sticky combined preview at right and four miniature interface theme previews below. On mobile, show the combined preview first and two columns of frame tiles; themes stack. Artwork must not cover the avatar's face. Backgrounds remain quieter than task text and controls.

FORM: Scoped extension of the incumbent Operate surface; seed key not applicable. The signature interaction is persistent frame-plus-theme previews across category changes. Hover gently tilts the frame artwork only when reduced motion is not requested.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Evidence: actual RewardsPage, UserAvatar, RewardThemeSync and shared sidebar components rendered in Chromium with synthetic fixture data clearly labeled in Chinese captures. No production database or account was changed. Shipping artwork is SVG; screenshots are browser captures.
