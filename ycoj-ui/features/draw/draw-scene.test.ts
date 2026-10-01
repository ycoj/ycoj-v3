import {
  DEFAULT_DRAW_BACKGROUND,
  sanitizeDrawScene,
  serializeDrawScene,
} from './draw-scene';
import { describe, expect, it } from 'vitest';

const scene = (overrides: {
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
}) => ({
  elements: overrides.elements,
  appState: overrides.appState,
  files: overrides.files,
});

describe('serializeDrawScene', () => {
  it('keeps elements and binary files', () => {
    const elements = [{ id: 'a', type: 'rectangle' }];
    const files = { 'file-id': { id: 'file-id', dataURL: 'data:image/png' } };

    const persisted = serializeDrawScene(
      scene({ elements, appState: {}, files })
    );

    expect(persisted.version).toBe(1);
    expect(persisted.elements).toBe(elements);
    expect(persisted.files).toBe(files);
  });

  it('drops session-only appState and keeps the canvas background', () => {
    const persisted = serializeDrawScene(
      scene({
        elements: [],
        appState: { viewBackgroundColor: '#123456', zoom: { value: 2 } },
        files: {},
      })
    );

    expect(persisted.appState).toEqual({ viewBackgroundColor: '#123456' });
  });

  it('falls back to the default background when appState is unusable', () => {
    expect(
      serializeDrawScene(scene({ elements: [], files: {} })).appState
    ).toEqual({ viewBackgroundColor: DEFAULT_DRAW_BACKGROUND });
    expect(
      serializeDrawScene(scene({ elements: [], appState: 'nope', files: {} }))
        .appState
    ).toEqual({ viewBackgroundColor: DEFAULT_DRAW_BACKGROUND });
    expect(
      serializeDrawScene(
        scene({
          elements: [],
          appState: { viewBackgroundColor: 42 },
          files: {},
        })
      ).appState
    ).toEqual({ viewBackgroundColor: DEFAULT_DRAW_BACKGROUND });
  });
});

describe('sanitizeDrawScene', () => {
  it('round-trips a serialized scene', () => {
    const serialized = serializeDrawScene(
      scene({
        elements: [{ id: 'a' }],
        appState: { viewBackgroundColor: '#abcdef' },
        files: { 'file-id': { id: 'file-id' } },
      })
    );

    expect(sanitizeDrawScene(serialized)).toEqual(serialized);
  });

  it.each([[null], [undefined], ['a scene'], [42], [[]]])(
    'returns null for the non-object value %s',
    (value) => {
      expect(sanitizeDrawScene(value)).toBeNull();
    }
  );

  it('replaces corrupt elements and files with empty containers', () => {
    const sanitized = sanitizeDrawScene({
      version: 1,
      elements: 'not-an-array',
      appState: { viewBackgroundColor: '#ffffff' },
      files: ['not-a-map'],
    });

    expect(sanitized?.elements).toEqual([]);
    expect(sanitized?.files).toEqual({});
  });

  it('restores a partial record missing appState and files', () => {
    const sanitized = sanitizeDrawScene({ elements: [{ id: 'a' }] });

    expect(sanitized).toEqual({
      version: 1,
      elements: [{ id: 'a' }],
      appState: { viewBackgroundColor: DEFAULT_DRAW_BACKGROUND },
      files: {},
    });
  });

  it.each([
    ['a named CSS color', 'white'],
    ['a bare hex value', 'ffffff'],
    ['a hash with too few digits', '#ff'],
    ['a non-hex digit', '#gggggg'],
    ['an empty string', ''],
  ])('rejects %s as a background color', (_label, background) => {
    const sanitized = sanitizeDrawScene({
      elements: [],
      appState: { viewBackgroundColor: background },
      files: {},
    });

    expect(sanitized?.appState.viewBackgroundColor).toBe(
      DEFAULT_DRAW_BACKGROUND
    );
  });

  it.each([
    ['short hex', '#fff'],
    ['six-digit hex', '#A1B2C3'],
    ['eight-digit hex with alpha', '#a1b2c3ff'],
  ])('preserves a %s background color', (_label, background) => {
    const sanitized = sanitizeDrawScene({
      elements: [],
      appState: { viewBackgroundColor: background },
      files: {},
    });

    expect(sanitized?.appState.viewBackgroundColor).toBe(background);
  });
});
