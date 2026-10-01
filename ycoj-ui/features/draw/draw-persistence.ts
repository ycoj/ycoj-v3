import type { PersistedDrawScene } from './draw-scene';

export type DrawSceneSaver = {
  // Trailing debounce: a burst of edits collapses into a single write of the
  // newest scene.
  schedule: (scene: PersistedDrawScene) => void;
  // Writes a pending scene immediately, without waiting for the debounce
  // window. Call it before the page goes away; a whiteboard draft is
  // best-effort, so the worst case is losing the last debounce window.
  flush: () => void;
};

export type DrawSceneSaverOptions = {
  save: (scene: PersistedDrawScene) => Promise<void>;
  delayMs?: number;
  onError?: (error: unknown) => void;
};

const DEFAULT_DELAY_MS = 1000;

export function createDrawSceneSaver({
  save,
  delayMs = DEFAULT_DELAY_MS,
  onError = (error) =>
    console.warn('Failed to save the whiteboard scene', error),
}: DrawSceneSaverOptions): DrawSceneSaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PersistedDrawScene | null = null;
  // Serializes writes so two scenes never race for the same store, and keeps
  // the queue alive when one write fails.
  let queue: Promise<void> = Promise.resolve();

  const run = () => {
    timer = null;
    const scene = pending;
    pending = null;
    if (!scene) return;
    queue = queue.then(() => save(scene)).catch(onError);
  };

  const schedule = (scene: PersistedDrawScene) => {
    pending = scene;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  };

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    run();
  };

  return { schedule, flush };
}
