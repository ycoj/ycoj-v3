/**
 * Resource-backed discussion nodes.
 *
 * The backend routes `/discuss/:type/:name` with `type` in
 * `problem | contest | training | homework | node` (`typeMapper` in
 * `handler/discussion.ts`, where `homework` and `contest` share
 * `TYPE_CONTEST`). The legacy UI links resource sidebars to those paths, so the
 * new list page reads the same pair instead of only a plain `node` id.
 */

export type DiscussionNodeType = 'node' | 'problem' | 'contest' | 'homework';

export type DiscussionNodeContext = {
  type: DiscussionNodeType;
  /** Resource id: a problem docId, a contest/homework docId, or a node id. */
  name: string;
};

export const DISCUSSION_NODE_TYPES: readonly DiscussionNodeType[] = [
  'node',
  'problem',
  'contest',
  'homework',
];

export function isDiscussionNodeType(
  value: string | undefined
): value is DiscussionNodeType {
  return (
    value === 'node' ||
    value === 'problem' ||
    value === 'contest' ||
    value === 'homework'
  );
}

function normalizeName(value: string | undefined) {
  const name = value?.trim();
  return name && name !== 'all' ? name : undefined;
}

/**
 * Resolves a discussion node context from page parameters.
 *
 * Accepted shapes:
 * - `/discussion/:type/:name` — the resource form the legacy `/discuss` uses
 *   (e.g. `/discussion/problem/P1000`);
 * - `/discussion?node=<id>` — the pre-existing plain node filter;
 * - `/discussion?type=<type>&name=<id>` — for links that keep a query string.
 *
 * A second route segment that is not a node type (e.g. a discussion id) is
 * ignored here; the `[did]` route resolves those.
 */
export function parseDiscussionNodeContext(input: {
  type?: string;
  name?: string;
  node?: string;
}): DiscussionNodeContext | null {
  const name = normalizeName(input.name);
  if (name && isDiscussionNodeType(input.type)) {
    return { type: input.type, name };
  }

  const node = normalizeName(input.node);
  if (node) return { type: 'node', name: node };

  return null;
}

/** Path of a discussion node, matching the legacy `/discuss/:type/:name`. */
export function discussionNodePath(
  type: DiscussionNodeType | string,
  name: string | number
): string {
  return `/discussion/${type}/${encodeURIComponent(String(name))}`;
}

/**
 * Create page for a node. Resource nodes carry the node in the path
 * (`/discussion/:type/:name/create`); standalone discussion nodes use the
 * node-filter entry the list page already accepts (`/discussion/create?node=`).
 */
export function discussionCreatePath(
  type: DiscussionNodeType | string,
  name: string | number
): string {
  if (type === 'node') {
    return `/discussion/create?node=${encodeURIComponent(String(name))}`;
  }
  return `${discussionNodePath(type, name)}/create`;
}

/** Where a discussion's node filter should point back to. */
export function nodeBackLink(context: DiscussionNodeContext | null): string {
  return context
    ? discussionNodePath(context.type, context.name)
    : '/discussion';
}
