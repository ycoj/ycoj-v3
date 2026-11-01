import ServerApis from '@/api/server/method';
import { cache } from 'react';
import 'server-only';

export type ResolvedDiscussionNode = {
  type: string;
  name: string;
  title: string;
  /** Whether the backend accepted the resource and returned a vnode. */
  exists: boolean;
};

function nodeTitle(vnode: Record<string, unknown>, fallback: string): string {
  const title = vnode.title;
  return typeof title === 'string' && title.trim() ? title : fallback;
}

/**
 * Resolves a discussion node through the backend, which validates the node's
 * visibility for the current viewer.
 *
 * Resource nodes are looked up from their document. The backend synthesizes a
 * placeholder vnode for an unknown plain node (`{ title: id }` with no `_id`),
 * so standalone nodes only count as existing when the stored node is found.
 */

export const getDiscussionNodeContext = cache(
  async (
    type: string,
    name: string
  ): Promise<ResolvedDiscussionNode | null> => {
    const response = await ServerApis.Discussion.getDiscussionInNode(
      type,
      name,
      1
    ).catch(() => null);
    if (!response || 'error' in response || !response.vnode) return null;
    const vnode = response.vnode as Record<string, unknown>;
    if (type === 'node' && !vnode._id) return null;
    return {
      type,
      name,
      title: nodeTitle(vnode, name),
      exists: true,
    };
  }
);
