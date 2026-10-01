import { createDrawSceneSaver } from './draw-persistence';
import type { PersistedDrawScene } from './draw-scene';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const DELAY_MS = 1000;

const makeScene = (id: string): PersistedDrawScene => ({
  version: 1,
  elements: [{ id }],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
});

// Drains the saver's promise queue, which is what actually calls save().
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('createDrawSceneSaver', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('collapses a burst of edits into one write of the newest scene', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS });

    saver.schedule(makeScene('first'));
    saver.schedule(makeScene('second'));
    saver.schedule(makeScene('third'));
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(DELAY_MS);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(makeScene('third'));
  });

  it('waits out the debounce window before writing', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS });

    saver.schedule(makeScene('a'));
    await vi.advanceTimersByTimeAsync(DELAY_MS - 1);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('keeps pushing the deadline back while edits keep arriving', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS });

    saver.schedule(makeScene('a'));
    await vi.advanceTimersByTimeAsync(600);
    saver.schedule(makeScene('b'));

    // The first schedule's deadline must not fire a write.
    await vi.advanceTimersByTimeAsync(400);
    expect(save).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(makeScene('b'));
  });

  it('flushes a pending scene without waiting for the timer', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS });

    saver.schedule(makeScene('a'));
    expect(() => saver.flush()).not.toThrow();
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(makeScene('a'));

    // The flushed scene must not be written a second time.
    await vi.advanceTimersByTimeAsync(DELAY_MS);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not write anything when there is nothing pending', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS });

    saver.flush();
    saver.schedule(makeScene('a'));
    saver.flush();
    saver.flush();
    await settle();

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('reports a failed write without throwing and keeps saving afterwards', async () => {
    const failure = new Error('quota exceeded');
    const save = vi
      .fn()
      .mockRejectedValueOnce(failure)
      .mockResolvedValue(undefined);
    const onError = vi.fn();
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS, onError });

    expect(() => {
      saver.schedule(makeScene('a'));
      saver.flush();
    }).not.toThrow();
    await settle();

    expect(onError).toHaveBeenCalledWith(failure);

    saver.schedule(makeScene('b'));
    saver.flush();
    await settle();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(makeScene('b'));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('queues a newer scene behind a write that is still in flight', async () => {
    let releaseFirst!: () => void;
    const inFlight = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const save = vi
      .fn()
      .mockReturnValueOnce(inFlight)
      .mockResolvedValue(undefined);
    const saver = createDrawSceneSaver({ save, delayMs: DELAY_MS });

    saver.schedule(makeScene('a'));
    saver.flush();
    saver.schedule(makeScene('b'));
    saver.flush();
    await settle();

    expect(save).toHaveBeenCalledTimes(1);

    releaseFirst();
    await settle();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith(makeScene('b'));
  });
});
