import { sanitizeDrawScene, type PersistedDrawScene } from './draw-scene';
import {
  DRAFT_DATABASES,
  makeDraftStorage,
} from '@/shared/lib/indexeddb-draft';

const DRAFT_ID = 'whiteboard';

const { getDraft, saveDraft } = makeDraftStorage<PersistedDrawScene>(
  DRAFT_DATABASES.draw.dbName,
  DRAFT_DATABASES.draw.storeName
);

export function loadDrawScene(): Promise<PersistedDrawScene | null> {
  return getDraft(DRAFT_ID);
}

export function saveDrawScene(scene: PersistedDrawScene): Promise<void> {
  return saveDraft(DRAFT_ID, scene);
}

export { sanitizeDrawScene };
