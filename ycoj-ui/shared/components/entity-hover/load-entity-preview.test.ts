import {
  classifyEntityPreview,
  clearEntityPreviewCache,
  loadEntityPreview,
} from '@/shared/components/entity-hover/load-entity-preview';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('@/api/client/method/entity-preview', () => ({
  getEntityPreview: () => ({ send: mocks.send }),
}));

const problem = {
  kind: 'problem' as const,
  id: 'P1000',
  pid: 'P1000',
  title: 'A + B',
  difficulty: 1,
  tags: ['math'],
  nAccept: 12,
  nSubmit: 40,
  hidden: false,
};

describe('classifyEntityPreview', () => {
  it('accepts a problem preview', () => {
    expect(classifyEntityPreview(problem).ok).toBe(true);
  });

  it.each([
    ['PermissionError', 'denied'],
    ['PrivilegeError', 'denied'],
    ['NotAssignedError', 'denied'],
    ['ProblemNotFoundError', 'missing'],
    ['ContestNotFoundError', 'missing'],
    ['TrainingNotFoundError', 'missing'],
    ['UserNotFoundError', 'missing'],
    ['ValidationError', 'failed'],
  ] as const)('maps %s to %s', (name, reason) => {
    expect(classifyEntityPreview({ error: { name } })).toEqual({
      ok: false,
      reason,
    });
  });

  it('treats an empty document as missing', () => {
    expect(classifyEntityPreview(null)).toEqual({
      ok: false,
      reason: 'missing',
    });
  });
});

describe('loadEntityPreview', () => {
  beforeEach(() => {
    clearEntityPreviewCache();
    mocks.send.mockReset();
  });

  it('fetches once for repeated and overlapping hovers', async () => {
    mocks.send.mockResolvedValue(problem);
    const [first, second] = await Promise.all([
      loadEntityPreview('problem', 'P1000'),
      loadEntityPreview('problem', 'P1000'),
    ]);
    await loadEntityPreview('problem', 'P1000');
    expect(first).toEqual({ ok: true, preview: problem });
    expect(second).toEqual(first);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });

  it('does not cache a network failure', async () => {
    mocks.send.mockRejectedValueOnce(new Error('offline'));
    mocks.send.mockResolvedValueOnce(problem);
    await expect(loadEntityPreview('problem', 'P1000')).resolves.toEqual({
      ok: false,
      reason: 'failed',
    });
    await expect(loadEntityPreview('problem', 'P1000')).resolves.toEqual({
      ok: true,
      preview: problem,
    });
    expect(mocks.send).toHaveBeenCalledTimes(2);
  });
});
