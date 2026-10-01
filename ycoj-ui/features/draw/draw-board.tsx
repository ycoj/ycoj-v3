'use client';

import DrawLoading from './draw-loading';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

// The Excalidraw font loader resolves every @font-face against this prefix and
// silently falls back to the esm.sh CDN when it is unset, so it must be
// assigned before the canvas chunk evaluates. Module scope runs before the
// dynamic import below; the guard keeps a prerender pass from touching window.
if (typeof window !== 'undefined') {
  window.EXCALIDRAW_ASSET_PATH = '/excalidraw/';
}

const DrawCanvas = dynamic(() => import('./draw-canvas'), {
  ssr: false,
  loading: DrawLoading,
});

export default function DrawBoard() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="size-full" data-llm-visible="true">
      <DrawCanvas theme={resolvedTheme === 'dark' ? 'dark' : 'light'} />
    </div>
  );
}
