export const DEFAULT_DRAW_BACKGROUND = '#ffffff';

// Elements and binary files are kept as opaque values: Excalidraw's own
// restore() owns their schema, so validating them here would only duplicate
// (and eventually drift from) it.
export type PersistedDrawScene = {
  version: 1;
  elements: unknown[];
  appState: {
    viewBackgroundColor: string;
  };
  files: Record<string, unknown>;
};

type DrawSceneSource = {
  elements: unknown;
  appState: unknown;
  files: unknown;
};

const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Excalidraw's appState carries per-session values (zoom, scroll, the current
// tool, open dialogs). Only the canvas background is worth restoring, so a
// reload reopens the board in a predictable state instead of a stale viewport.
export function serializeDrawScene(scene: DrawSceneSource): PersistedDrawScene {
  const appState = isRecord(scene.appState) ? scene.appState : {};
  const viewBackgroundColor = appState.viewBackgroundColor;

  return {
    version: 1,
    elements: Array.isArray(scene.elements) ? scene.elements : [],
    appState: {
      viewBackgroundColor:
        typeof viewBackgroundColor === 'string'
          ? viewBackgroundColor
          : DEFAULT_DRAW_BACKGROUND,
    },
    files: isRecord(scene.files) ? scene.files : {},
  };
}

// Drafts are user-writable browser storage, so a partial or corrupted record
// must degrade to an empty board rather than crash the page. Returns null when
// there is nothing usable to restore.
export function sanitizeDrawScene(value: unknown): PersistedDrawScene | null {
  if (!isRecord(value)) return null;

  const appState = isRecord(value.appState) ? value.appState : {};
  const background = appState.viewBackgroundColor;

  return {
    version: 1,
    elements: Array.isArray(value.elements) ? value.elements : [],
    appState: {
      viewBackgroundColor:
        typeof background === 'string' && HEX_COLOR.test(background)
          ? background
          : DEFAULT_DRAW_BACKGROUND,
    },
    files: isRecord(value.files) ? value.files : {},
  };
}
