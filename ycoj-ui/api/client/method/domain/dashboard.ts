import { clientRequest } from '@/api/client';
import type { DomainMutationResponse } from '@/api/client/method/domain/mutation';

/** Resets the active domain's discussion nodes from system configuration. */
export const initDiscussionNodes = () =>
  clientRequest.Post<DomainMutationResponse>('/domain/dashboard', {
    operation: 'init_discussion_node',
  });

export type SaveDomainSettingsPayload = Record<
  string,
  string | number | boolean
>;

/**
 * Saves registered domain settings. Boolean checkboxes must also list their
 * keys in `booleanKeys` so an unchecked box is persisted as `false`.
 */
export const saveDomainSettings = (
  payload: SaveDomainSettingsPayload,
  booleanKeys: string[] = []
) =>
  clientRequest.Post<DomainMutationResponse>('/domain/edit', {
    ...payload,
    // Listing every boolean key makes the backend persist unchecked boxes as
    // `false`; checked keys still win because the payload carries `true`.
    ...(booleanKeys.length
      ? {
          booleanKeys: Object.fromEntries(
            booleanKeys.map((key) => [key, true])
          ),
        }
      : {}),
  });
