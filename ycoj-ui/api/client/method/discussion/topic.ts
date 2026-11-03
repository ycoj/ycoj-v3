import { clientRequest } from '@/api/client';
import type { ObjectId } from '@/shared/types/shared';

/**
 * Backend `Handler#back()` echoes the referer as `url` for mutations. The
 * framework sends errors as `{ error }` instead, so mutations are wrapped in
 * `Errorable` by the caller.
 */
export type DiscussionMutationResponse = {
  url?: string;
  error?: never;
};

export type DiscussionCreateInput = {
  type: string;
  title: string;
  content: string;
  highlight?: boolean;
  pin?: boolean;
};

export type DiscussionCreateResponse = DiscussionMutationResponse & {
  did?: ObjectId;
};

export type DiscussionUpdateInput = {
  title: string;
  content: string;
  highlight?: boolean;
  pin?: boolean;
};

export const createDiscussion = (
  type: string,
  name: string,
  input: DiscussionCreateInput
) =>
  clientRequest.Post<DiscussionCreateResponse>(
    `/discuss/${encodeURIComponent(type)}/${encodeURIComponent(name)}/create`,
    {
      type,
      title: input.title,
      content: input.content,
      highlight: input.highlight ?? false,
      pin: input.pin ?? false,
    }
  );

export const updateDiscussion = (did: ObjectId, input: DiscussionUpdateInput) =>
  clientRequest.Post<DiscussionMutationResponse>(`/discuss/${did}/edit`, {
    operation: 'update',
    did,
    title: input.title,
    content: input.content,
    highlight: input.highlight ?? false,
    pin: input.pin ?? false,
  });

export const deleteDiscussion = (did: ObjectId) =>
  clientRequest.Post<DiscussionMutationResponse>(`/discuss/${did}/edit`, {
    operation: 'delete',
    did,
  });

export const setDiscussionLock = (did: ObjectId, lock: boolean) =>
  clientRequest.Post<DiscussionMutationResponse>(`/discuss/${did}`, {
    operation: 'setLock',
    did,
    lock,
  });

export const starDiscussion = (did: ObjectId, star: boolean) =>
  clientRequest.Post<DiscussionMutationResponse & { star?: boolean }>(
    `/discuss/${did}`,
    {
      operation: 'star',
      did,
      star,
    }
  );

export type DiscussionReactionResult = DiscussionMutationResponse & {
  doc?: { react?: Record<string, number> };
  sdoc?: { react?: Record<string, number> };
};

export const reactToDiscussion = (
  did: ObjectId,
  nodeType: 'did' | 'drid',
  id: ObjectId,
  emoji: string,
  reverse: boolean
) =>
  clientRequest.Post<DiscussionReactionResult>(`/discuss/${did}`, {
    operation: 'reaction',
    nodeType,
    id,
    emoji,
    reverse,
  });
