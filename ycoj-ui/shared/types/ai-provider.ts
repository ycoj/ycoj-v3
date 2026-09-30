export const AI_THINKING_LEVELS = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] as const;

export type AiProviderModel = {
  id: string;
  name: string;
  model: string;
  reasoning: boolean;
  thinkingLevel: (typeof AI_THINKING_LEVELS)[number];
  contextTokens: number;
  maxTokens: number;
};

export type AiProvider = {
  id: string;
  name: string;
  apiType: 'openai-responses' | 'openai-completions';
  baseUrl: string;
  apiKey: string;
  models: AiProviderModel[];
};

export type AiModelSelection = { providerId: string; modelId: string };

export type AiProviderConfig = {
  version: 1;
  providers: AiProvider[];
  dataGeneration?: AiModelSelection;
  htmlToMarkdown?: AiModelSelection;
};
