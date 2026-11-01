import { randomProblemHref } from './random';
import { describe, expect, it } from 'vitest';

describe('randomProblemHref', () => {
  it.each([
    [{ url: '/p/P1000' }, '/problem/P1000'],
    [{ url: '/problem/P1000' }, '/problem/P1000'],
    [{ pid: 1000 }, '/problem/1000'],
    [{ pid: 'P2000' }, '/problem/P2000'],
    [{ url: '/p/P1000', pid: 1000 }, '/problem/P1000'],
    [{ url: '/login' }, null],
    [{}, null],
  ])('maps %o to %s', (response, expected) => {
    expect(randomProblemHref(response)).toBe(expected);
  });
});
