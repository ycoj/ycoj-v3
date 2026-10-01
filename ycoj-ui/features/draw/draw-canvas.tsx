'use client';

import '@excalidraw/excalidraw/index.css';
import { createDrawSceneSaver } from './draw-persistence';
import { serializeDrawScene } from './draw-scene';
import { loadDrawScene, saveDrawScene } from './draw-storage';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ExcalidrawInitialDataState } from '@excalidraw/excalidraw/types';
import { useLocale } from 'next-intl';
import { useEffect, useMemo } from 'react';
import type { ComponentProps } from 'react';

type Props = {
  theme: NonNullable<ComponentProps<typeof Excalidraw>['theme']>;
};

async function loadInitialScene() {
  // A blocked, private-mode, or quota-exhausted IndexedDB must degrade to an
  // empty board instead of failing the page.
  const scene = await loadDrawScene().catch(() => null);
  // Excalidraw's own restore() validates elements and binary files on load; the
  // persisted shape only guarantees that they are a list and a map.
  return scene as ExcalidrawInitialDataState | null;
}

export default function DrawCanvas({ theme }: Props) {
  const locale = useLocale();
  const saver = useMemo(
    () => createDrawSceneSaver({ save: saveDrawScene }),
    []
  );

  useEffect(() => {
    const flush = () => saver.flush();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      saver.flush();
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [saver]);

  return (
    <Excalidraw
      theme={theme}
      langCode={locale === 'zh' ? 'zh-CN' : 'en'}
      initialData={loadInitialScene}
      onChange={(elements, appState, files) => {
        saver.schedule(serializeDrawScene({ elements, appState, files }));
      }}
    />
  );
}
