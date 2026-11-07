import { clientRequest } from '@/api/client';
import type {
  EntityKind,
  EntityPreview,
} from '@/shared/components/entity-hover/types';

type EntityPreviewError = {
  error?: {
    name?: string;
  };
};

export const getEntityPreview = (kind: EntityKind, id: string) =>
  clientRequest.Post<EntityPreview | EntityPreviewError | null>(
    '/api/entity.preview',
    { args: { kind, id } }
  );
