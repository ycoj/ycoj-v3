import type { Errorable } from '@/shared/types/error';

/** Every domain mutation answers with `{url}` or `{error}` under JSON. */
export type DomainMutationResponse = Errorable<{ url?: string }>;
