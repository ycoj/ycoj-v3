---
name: YCOJ
description: Existing learning workspace with optional game inspired rewards themes.
colors:
  'background': 'oklch(1 0 0)'
  'foreground': 'oklch(0.145 0 0)'
  'primary': 'oklch(0.61 0.11 222)'
  'primary-foreground': 'oklch(0.98 0.02 201)'
  'secondary': 'oklch(0.967 0.001 286.375)'
  'secondary-foreground': 'oklch(0.21 0.006 285.885)'
  'muted': 'oklch(0.97 0 0)'
  'muted-foreground': 'oklch(0.556 0 0)'
  'accent-foreground': 'oklch(0.205 0 0)'
  'destructive': 'oklch(0.58 0.22 27)'
  'border': 'oklch(0.922 0 0)'
  'ring': 'oklch(0.708 0 0)'
  'sidebar': 'oklch(0.985 0 0)'
  'dark-background': 'oklch(0.145 0 0)'
  'dark-foreground': 'oklch(0.985 0 0)'
  'dark-card': 'oklch(0.205 0 0)'
  'dark-primary': 'oklch(0.71 0.13 215)'
  'dark-primary-foreground': 'oklch(0.3 0.05 230)'
  'dark-secondary': 'oklch(0.274 0.006 286.033)'
  'dark-muted': 'oklch(0.269 0 0)'
  'dark-muted-foreground': 'oklch(0.708 0 0)'
  'dark-accent': 'oklch(0.371 0 0)'
  'dark-destructive': 'oklch(0.704 0.191 22.216)'
  'dark-border': 'oklch(1 0 0 / 10%)'
  'dark-input': 'oklch(1 0 0 / 15%)'
  'dark-ring': 'oklch(0.556 0 0)'
  'dark-sidebar-primary': 'oklch(0.8 0.13 212)'
  'theme-background': 'oklch(0.965 0.018 var(--reward-hue))'
  'theme-foreground': 'oklch(0.25 0.025 var(--reward-hue))'
  'theme-card': 'oklch(0.995 0.003 var(--reward-hue))'
  'theme-primary': 'oklch(0.46 0.12 var(--reward-hue))'
  'theme-primary-foreground': 'oklch(0.99 0.003 var(--reward-hue))'
  'theme-secondary': 'oklch(0.93 0.025 var(--reward-hue))'
  'theme-muted': 'oklch(0.94 0.018 var(--reward-hue))'
  'theme-muted-foreground': 'oklch(0.46 0.025 var(--reward-hue))'
  'theme-accent': 'oklch(0.91 0.035 var(--reward-hue))'
  'theme-destructive': 'oklch(0.58 0.22 27)'
  'theme-border': 'oklch(0.87 0.025 var(--reward-hue))'
  'theme-sidebar': 'oklch(0.975 0.015 var(--reward-hue))'
  'theme-dark-background': 'oklch(0.2 0.028 var(--reward-hue))'
  'theme-dark-foreground': 'oklch(0.95 0.012 var(--reward-hue))'
  'theme-dark-card': 'oklch(0.25 0.025 var(--reward-hue))'
  'theme-dark-primary': 'oklch(0.78 0.105 var(--reward-hue))'
  'theme-dark-primary-foreground': 'oklch(0.21 0.03 var(--reward-hue))'
  'theme-dark-secondary': 'oklch(0.3 0.03 var(--reward-hue))'
  'theme-dark-muted': 'oklch(0.29 0.025 var(--reward-hue))'
  'theme-dark-muted-foreground': 'oklch(0.76 0.025 var(--reward-hue))'
  'theme-dark-accent': 'oklch(0.34 0.045 var(--reward-hue))'
  'theme-dark-destructive': 'oklch(0.704 0.191 22.216)'
  'theme-dark-border': 'oklch(0.37 0.03 var(--reward-hue))'
  'theme-dark-sidebar': 'oklch(0.225 0.028 var(--reward-hue))'
typography:
  headline:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: '1.75rem'
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 400
    lineHeight: '1.5rem'
  body-compact:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.25rem'
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 400
    lineHeight: '1rem'
rounded:
  'sm': '0.375rem'
  'md': '0.5rem'
  'lg': '0.625rem'
  'xl': '0.875rem'
  'full': '9999px'
  'avatar': '28%'
spacing:
  '1': '0.25rem'
  '2': '0.5rem'
  '3': '0.75rem'
  '4': '1rem'
  '5': '1.25rem'
  '6': '1.5rem'
  '8': '2rem'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    rounded: '{rounded.lg}'
    height: '2rem'
    padding: '0 0.625rem'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    height: '2rem'
    padding: '0 0.625rem'
  input:
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    height: '2rem'
    padding: '0.25rem 0.625rem'
  category-chip:
    typography: '{typography.body-compact}'
    rounded: '{rounded.full}'
    padding: '0.25rem 0.75rem'
  reward-card:
    backgroundColor: '{colors.background}'
    rounded: '{rounded.xl}'
    padding: '0.75rem'
  sidebar-link:
    textColor: '{colors.foreground}'
    rounded: '{rounded.md}'
    height: '2rem'
    padding: '0.5rem'
  theme-thumbnail:
    backgroundColor: '{colors.theme-background}'
    rounded: '{rounded.lg}'
    height: '9rem'
  frame-avatar:
    rounded: '{rounded.avatar}'
    size: '5rem'
---

# Design System: YCOJ

## Overview

**Creative North Star: "The YCOJ learning workspace"**

YCOJ uses a compact learning workspace: Inter typography, semantic surfaces, a persistent desktop sidebar, and small native controls. This record describes the built interface and its approved rewards expansion; the existing product layout and visual hierarchy remain the foundation.

Personal expression comes from five rounded-square sticker frames and four optional interface themes. Quiet scenery and tinted semantic surfaces support the learning interface, while the avatar artwork carries the more playful detail.

**Key Characteristics:**

- Compact text and controls with clear headings and restrained surface separation.
- Light and dark semantic palettes; optional themes tint the shell and its controls.
- Original sticker frames with white edging and an unobstructed avatar center.

## Colors

The default palette combines a cyan primary with neutral surfaces. Optional rewards themes use a shared OKLCH lightness/chroma system with a per-theme hue.

### Primary

The default primary is used by actions, progress, and selected states. The dark palette raises its lightness and uses a dark primary foreground. The frontmatter preserves the source OKLCH values.

### Secondary

Secondary, muted, and accent are semantic surface roles. Reward currency keeps its existing amber status colors; frame-stage colors belong to artwork presentation rather than to the app palette.

### Neutral

Equal source values share a frontmatter primitive. The table maps the incumbent CSS roles to those primitives; default means light mode with no equipped rewards theme.

| CSS roles                                                                   | Default primitive    | Dark primitive                     |
| --------------------------------------------------------------------------- | -------------------- | ---------------------------------- |
| --background, --card, --popover                                             | background           | dark-background, dark-card         |
| --foreground, --card-foreground, --popover-foreground, --sidebar-foreground | foreground           | dark-foreground                    |
| --primary, --sidebar-primary                                                | primary              | dark-primary, dark-sidebar-primary |
| --primary-foreground, --sidebar-primary-foreground                          | primary-foreground   | dark-primary-foreground            |
| --secondary                                                                 | secondary            | dark-secondary                     |
| --secondary-foreground                                                      | secondary-foreground | dark-foreground                    |
| --muted, --accent, --sidebar-accent                                         | muted                | dark-accent, dark-muted            |
| --muted-foreground                                                          | muted-foreground     | dark-muted-foreground              |
| --accent-foreground, --sidebar-accent-foreground                            | accent-foreground    | dark-foreground                    |
| --destructive                                                               | destructive          | dark-destructive                   |
| --border, --input, --sidebar-border                                         | border               | dark-border, dark-input            |
| --ring, --sidebar-ring                                                      | ring                 | dark-ring                          |
| --sidebar                                                                   | sidebar              | dark-card                          |

### Optional interface themes

| Equipment ID  | Character                  | Hue | Canvas artwork             |
| ------------- | -------------------------- | --- | -------------------------- |
| accent-forest | Mint block forest          | 155 | /rewards/themes/forest.svg |
| accent-violet | Lavender space exploration | 295 | /rewards/themes/orbit.svg  |
| accent-racing | Racing blue                | 255 | /rewards/themes/racing.svg |
| accent-ocean  | Turquoise sprite bay       | 200 | /rewards/themes/ocean.svg  |

The theme-prefixed color primitives record the actual shared CSS formulas. Their --reward-hue is supplied by the chosen ID. Theme-dark primitives describe the same roles in dark mode. Card/popover text follows foreground; popovers follow card; inputs follow border; ring follows primary; sidebar text follows foreground; sidebar primary and accent follow the corresponding main roles.

Equipping a theme applies the palette to the app shell, sidebar, buttons, inputs, cards, text, selection, and scrollbars. The document root also receives the equipped ID so portaled menus and dialogs inherit it. Local theme previews carry their own ID; selecting one does not recolor the equipped shell. The default destructive and chart tokens remain inherited.

**The Semantic Surface Rule.** Use the existing semantic variables for ordinary controls, text, borders, and surfaces so an equipped theme reaches the whole app shell.

**The Quiet Scenery Rule.** Apply scene artwork to the content canvas and appearance previews; keep text-bearing cards and the sidebar on their semantic surface colors.

## Typography

**Body Font:** Inter, loaded locally as the main sans family. Geist Sans and Geist Mono are also loaded by the root layout; rewards controls and headings retain Inter.

The interface uses a compact type hierarchy without a separate display face. Frontmatter headline records the desktop rewards heading; it reduces to (1.25rem) below the medium breakpoint. Section headings use title, body text commonly uses body-compact, and prices, status, and supporting text use label. Item and control labels use medium weight (500); section and page headings use semibold (600). Balances, prices, and progress use tabular numerals.

## Layout

The existing shell has a desktop sidebar (16rem), icon rail (3rem), and mobile sheet (18rem). The main area uses the incumbent centered container with (1rem) shell padding. The mobile sidebar boundary is (768px).

Rewards use the existing quarter-rem spacing rhythm. The shop becomes a main column plus a (19rem) preview at the large breakpoint (1024px), separated by (1.5rem). The preview sticks (1.5rem) from the top. Below that breakpoint it appears before the items. Frame tiles use two columns, increasing to three at (1280px); theme tiles stack until (640px), then use two columns.

These rewards-specific grids describe this surface, not a new layout prescription for every YCOJ page.

## Elevation & Depth

Depth comes mainly from tonal surfaces, fine borders, and selected-state color. Shared cards use a subtle foreground ring; the inset shell and active native tabs use the existing small shadow. Reward item cards and the combined preview use borders without added decorative shadows. Frame artwork includes its white sticker edge rather than a CSS drop shadow.

## Shapes

The incumbent radius base is (0.625rem / 10px). Its rounded-xl cards resolve to (0.875rem / 14px), with smaller controls and inner stages using the existing radius steps. Category filters are pills.

Decorated avatars use a rounded-square corner shape (28%). Their SVG overlay spans (132%) of the avatar and is offset (-16%) on each axis. Five IDs select tiger, block adventure, speed racing, space exploration, and sprite companion artwork: frame-tiger, frame-pixel, frame-racer, frame-orbit, and frame-slime.

**The Clear Avatar Rule.** Place frame decoration around the rounded-square avatar and keep its center clear.

## Components

### Buttons and fields

Shared buttons remain compact (2rem high) with medium text, semantic variants, reduced opacity when disabled, and a visible keyboard focus ring. The theme scope supplies the primary foreground/background even in dark mode; its primary hover mixes (90%) primary with background. Outline and ghost buttons retain their shared hover states. Fields keep their semantic stroke, transparent light background, tinted dark background, and destructive invalid state.

### Navigation and tabs

Sidebar links use the sidebar accent for hover and active states, with medium active labels. Navigation remains a sidebar on desktop and a sheet on mobile. Native tabs use a muted track and a raised active segment; rewards keep the existing tasks/shop/history sequence.

### Reward cards and category chips

Item tiles use semantic card surfaces, a primary border and light primary tint when selected, and a check marker. Hover changes the border; keyboard focus has a visible outline. Category chips expose their pressed state and use a primary border/tint when selected. Ownership, current equipment, price, and pending actions remain separate visible states.

### Combined appearance preview

The preview composes the chosen frame and theme. Selection updates only the corresponding equipment slot, preserving other preview selections across category changes and owned-only filtering. Choosing an owned-only replacement updates the combined preview as well as the selected item. Buying, equipping, and removing keep their distinct existing actions.

### Theme thumbnails and frame stages

Each miniature theme is an interface: a sidebar (23% of its width), semantic card rows, and a primary action over the actual scene. The thumbnail is (9rem) tall. The larger canvas uses a bottom-centered, non-repeating cover background; thumbnails fit artwork to their bounds.

Frame tiles use a quiet light/dark stage palette for the individual artwork. On hover, only the frame decoration tilts (-4deg) over (180ms ease-out), and only when reduced motion is not requested.

## Do's and Don'ts

### Do:

- **Do** keep the existing sidebar, tabs, localization, and native controls when extending the rewards shop.
- **Do** preserve the accent equipment slot and the accent-forest, accent-violet, accent-racing, and accent-ocean IDs.
- **Do** keep frame and theme selections together in the preview as categories change; show actual ownership and equipment separately.
- **Do** use supplied-reference-inspired original SVG for the sticker frames and quiet theme scenes.

### Don't:

- **Don't** use preview selection to spend coins or change equipped items; redemption and equipment require their existing actions.
- **Don't** cover the avatar face with decorative frame artwork.
- **Don't** apply sticker palettes as hardcoded replacements for ordinary UI semantic colors.
- **Don't** treat synthetic fixture screenshots as production-account evidence or as artwork assets.

Evidence checked: app/globals.css; app/layout.tsx; rewards styles, page, frame, theme preview and theme sync; app-frame and user-avatar; shared button, input, card, tabs and sidebar primitives; shipping frame/scene SVGs; and the native desktop, mobile and dark captures in docs/previews/game-themes/. Those captures use a clearly labeled synthetic account fixture. The SVG frames are supplied-reference-inspired original artwork; browser captures document rendered behavior and are not shipping artwork. No pre-existing visual drift was established or repaired by this extraction.
