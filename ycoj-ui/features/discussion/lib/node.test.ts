import {
  discussionCreatePath,
  discussionNodePath,
  isDiscussionNodeType,
  nodeBackLink,
  parseDiscussionNodeContext,
} from './node';
import { describe, expect, it } from 'vitest';

describe('parseDiscussionNodeContext', () => {
  it.each([
    ['problem', 'P1000'],
    ['contest', '66aa66aa66aa66aa66aa66aa'],
    ['homework', '66aa66aa66aa66aa66aa66aa'],
  ] as const)('reads the %s resource node from path segments', (type, name) => {
    expect(parseDiscussionNodeContext({ type, name })).toEqual({ type, name });
  });

  it('reads a plain node from the legacy ?node= filter', () => {
    expect(parseDiscussionNodeContext({ node: 'math' })).toEqual({
      type: 'node',
      name: 'math',
    });
  });

  it('falls back to the query form when only type and name are present', () => {
    expect(
      parseDiscussionNodeContext({ type: 'problem', name: 'P1000' })
    ).toEqual({ type: 'problem', name: 'P1000' });
  });

  it('prefers the path resource over a stale node query', () => {
    expect(
      parseDiscussionNodeContext({
        type: 'problem',
        name: 'P1000',
        node: 'math',
      })
    ).toEqual({ type: 'problem', name: 'P1000' });
  });

  it.each([
    [{ node: 'all' }, null],
    [{ node: '  ' }, null],
    [{ type: 'not-a-type', name: 'x' }, null],
    [{ type: 'problem' }, null],
    [{}, null],
  ] as const)('returns null or a node fallback for %j', (input, expected) => {
    expect(parseDiscussionNodeContext(input)).toEqual(expected);
  });

  it('trims resource names', () => {
    expect(
      parseDiscussionNodeContext({ type: 'problem', name: ' P1000 ' })
    ).toEqual({ type: 'problem', name: 'P1000' });
  });
});

describe('discussion node paths', () => {
  it('mirrors the legacy /discuss/:type/:name path', () => {
    expect(discussionNodePath('problem', 'P1000')).toBe(
      '/discussion/problem/P1000'
    );
    expect(discussionNodePath('contest', 42)).toBe('/discussion/contest/42');
  });

  it('encodes resource names', () => {
    expect(discussionNodePath('problem', 'a/b')).toBe(
      '/discussion/problem/a%2Fb'
    );
  });

  it('sends resource create links to the node path', () => {
    expect(discussionCreatePath('problem', 'P1000')).toBe(
      '/discussion/problem/P1000/create'
    );
  });

  it('sends plain node create links to the query entry the list page reads', () => {
    expect(discussionCreatePath('node', 'math')).toBe(
      '/discussion/create?node=math'
    );
  });

  it('links back to the node listing', () => {
    expect(nodeBackLink({ type: 'homework', name: '42' })).toBe(
      '/discussion/homework/42'
    );
    expect(nodeBackLink(null)).toBe('/discussion');
  });

  it('recognizes only the backend node types', () => {
    expect(isDiscussionNodeType('problem')).toBe(true);
    expect(isDiscussionNodeType('node')).toBe(true);
    expect(isDiscussionNodeType('training')).toBe(false);
    expect(isDiscussionNodeType(undefined)).toBe(false);
  });
});
