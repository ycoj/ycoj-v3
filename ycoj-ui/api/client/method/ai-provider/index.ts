import { clientRequest } from '@/api/client';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import type { Errorable } from '@/shared/types/error';

export const saveAiProviderConfig = (config: AiProviderConfig) =>
  clientRequest.Post<Errorable<{ url: string }>>('/manage/ai-provider', {
    value: JSON.stringify(config),
  });

const AiProvider = { saveAiProviderConfig };
export default AiProvider;
