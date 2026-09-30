import {
  createAiProviderSchema,
  getAiProviderDefaults,
} from './ai-provider-form-utils';
import messages from '@/messages/en';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import { describe, expect, it } from 'vitest';

const schema = createAiProviderSchema(messages.aiProvider.validation);
function fixture(): AiProviderConfig {
  return {
    version: 1,
    providers: [
      {
        id: 'provider-1',
        name: 'OpenAI',
        apiType: 'openai-responses',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: [
          {
            id: 'model-1',
            name: 'Model',
            model: 'api-model',
            reasoning: true,
            thinkingLevel: 'high',
            contextTokens: 128000,
            maxTokens: 32000,
          },
        ],
      },
    ],
    dataGeneration: { providerId: 'provider-1', modelId: 'model-1' },
    htmlToMarkdown: { providerId: 'provider-1', modelId: 'model-1' },
  };
}

describe('AI provider form validation', () => {
  it.each([
    [8192, 1024, true],
    [2000000, 1000000, true],
    [8191, 1024, false],
    [2000001, 1024, false],
    [128000, 1023, false],
    [2000000, 1000001, false],
    [128000, 128001, false],
    [128000.5, 32000, false],
    [128000, 32000.5, false],
  ])(
    'validates context %s and output %s',
    (contextTokens, maxTokens, valid) => {
      const config = fixture();
      Object.assign(config.providers[0].models[0], {
        contextTokens,
        maxTokens,
      });
      expect(schema.safeParse(config).success).toBe(valid);
    }
  );
  it.each(['ftp://example.com', 'invalid-url', ''])(
    'rejects base URL %s',
    (baseUrl) => {
      const config = fixture();
      config.providers[0].baseUrl = baseUrl;
      expect(schema.safeParse(config).success).toBe(false);
    }
  );
  it('requires both selections to reference models owned by their providers', () => {
    const config = fixture();
    config.htmlToMarkdown = {
      providerId: 'provider-1',
      modelId: 'missing-model',
    };
    const result = schema.safeParse(config);
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toBe(
        messages.aiProvider.validation.selectionRequired
      );
  });
  it('uses the data-generation model for configurations without a conversion selection', () => {
    const config = fixture();
    delete config.htmlToMarkdown;
    expect(getAiProviderDefaults(config).htmlToMarkdown).toEqual(
      config.dataGeneration
    );
  });
});
