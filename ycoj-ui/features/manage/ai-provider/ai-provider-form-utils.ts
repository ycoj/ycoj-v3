import {
  AI_THINKING_LEVELS,
  type AiModelSelection,
  type AiProvider,
  type AiProviderConfig,
  type AiProviderModel,
} from '@/shared/types/ai-provider';
import { z } from 'zod';

type ValidationMessages = {
  required: string;
  invalidUrl: string;
  contextRange: string;
  outputRange: string;
  outputExceedsContext: string;
  selectionRequired: string;
  providerRequired: string;
};

export function createAiProviderSchema(messages: ValidationMessages) {
  const required = z.string().trim().min(1, messages.required);
  const model = z
    .object({
      id: z.string(),
      name: required,
      model: required,
      reasoning: z.boolean(),
      thinkingLevel: z.enum(AI_THINKING_LEVELS),
      contextTokens: z
        .number()
        .int(messages.contextRange)
        .min(8192, messages.contextRange)
        .max(2_000_000, messages.contextRange),
      maxTokens: z
        .number()
        .int(messages.outputRange)
        .min(1024, messages.outputRange)
        .max(1_000_000, messages.outputRange),
    })
    .refine((value) => value.maxTokens <= value.contextTokens, {
      message: messages.outputExceedsContext,
      path: ['maxTokens'],
    });
  const selection = z
    .object({ providerId: z.string(), modelId: z.string() })
    .optional();
  return z
    .object({
      version: z.literal(1),
      providers: z
        .array(
          z.object({
            id: z.string(),
            name: required,
            apiType: z.enum(['openai-responses', 'openai-completions']),
            baseUrl: z
              .string()
              .trim()
              .url(messages.invalidUrl)
              .refine(
                (value) => /^https?:\/\//.test(value),
                messages.invalidUrl
              ),
            apiKey: z.string(),
            models: z.array(model).min(1, messages.required),
          })
        )
        .min(1, messages.providerRequired),
      dataGeneration: selection,
      htmlToMarkdown: selection,
    })
    .superRefine((config, ctx) => {
      for (const key of ['dataGeneration', 'htmlToMarkdown'] as const) {
        const selected = config[key];
        if (
          !config.providers.some(
            (provider) =>
              provider.id === selected?.providerId &&
              provider.models.some((item) => item.id === selected?.modelId)
          )
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: messages.selectionRequired,
          });
        }
      }
    });
}

export function createAiModel(name: string): AiProviderModel {
  return {
    id: `model-${crypto.randomUUID()}`,
    name,
    model: '',
    reasoning: true,
    thinkingLevel: 'high',
    contextTokens: 128_000,
    maxTokens: 32_000,
  };
}

export function createAiProvider(name: string, modelName: string): AiProvider {
  return {
    id: `provider-${crypto.randomUUID()}`,
    name,
    apiType: 'openai-responses',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    models: [createAiModel(modelName)],
  };
}

export function getAiProviderDefaults(
  config: AiProviderConfig
): AiProviderConfig {
  const firstProvider = config.providers[0];
  const firstModel = firstProvider?.models[0];
  const first =
    firstProvider && firstModel
      ? { providerId: firstProvider.id, modelId: firstModel.id }
      : undefined;
  const valid = (selection?: AiModelSelection) =>
    config.providers.some(
      (provider) =>
        provider.id === selection?.providerId &&
        provider.models.some((model) => model.id === selection?.modelId)
    );
  const dataGeneration = valid(config.dataGeneration)
    ? config.dataGeneration
    : first;
  return {
    ...config,
    dataGeneration,
    htmlToMarkdown: valid(config.htmlToMarkdown)
      ? config.htmlToMarkdown
      : dataGeneration,
  };
}

export function isAiModelSelected(
  config: AiProviderConfig,
  providerId: string,
  modelId?: string
) {
  return [config.dataGeneration, config.htmlToMarkdown].some(
    (selection) =>
      selection?.providerId === providerId &&
      (!modelId || selection.modelId === modelId)
  );
}

export function clearAiProviderKeys(
  config: AiProviderConfig
): AiProviderConfig {
  return {
    ...config,
    providers: config.providers.map((provider) => ({
      ...provider,
      apiKey: '',
    })),
  };
}
