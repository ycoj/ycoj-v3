import { alova } from '@/api/server';
import type { Errorable } from '@/shared/types/error';

export const getAiProviderConfig = () =>
  alova.Get<Errorable<{ config: string }> | { url: string }>(
    '/manage/ai-provider',
    { cacheFor: 0 }
  );

const AiProvider = { getAiProviderConfig };
export default AiProvider;
