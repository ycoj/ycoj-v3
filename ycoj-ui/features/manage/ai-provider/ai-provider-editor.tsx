import AiProviderField from './ai-provider-field';
import { createAiModel, isAiModelSelected } from './ai-provider-form-utils';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { FieldGroup } from '@/shared/components/ui/field';
import {
  AI_THINKING_LEVELS,
  type AiProviderConfig,
} from '@/shared/types/ai-provider';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFieldArray, type Control } from 'react-hook-form';

type Props = {
  index: number;
  control: Control<AiProviderConfig>;
  values: AiProviderConfig;
  savedConfig: AiProviderConfig;
  saving: boolean;
  onRemove: () => void;
};

export default function AiProviderEditor({
  index,
  control,
  values,
  savedConfig,
  saving,
  onRemove,
}: Props) {
  const t = useTranslations('aiProvider');
  const { fields, append, remove } = useFieldArray({
    control,
    name: `providers.${index}.models`,
    keyName: 'fieldKey',
  });
  const provider = values.providers[index];
  if (!provider) return null;
  const providerSelected =
    isAiModelSelected(values, provider.id) ||
    isAiModelSelected(savedConfig, provider.id);
  return (
    <Card className="min-w-0" data-llm-visible="true">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3 border-b">
        <h2 className="min-w-0 text-base font-semibold break-words">
          {provider.name || t('newProvider')}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving || providerSelected}
          onClick={onRemove}
          aria-label={t('removeProviderNamed', {
            name: provider.name || t('newProvider'),
          })}
        >
          <Trash2 aria-hidden="true" />
          {t('removeProvider')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        <FieldGroup className="grid items-start gap-5 sm:grid-cols-2">
          <AiProviderField
            control={control}
            name={`providers.${index}.name`}
            label={t('providerName')}
          />
          <AiProviderField
            control={control}
            name={`providers.${index}.baseUrl`}
            label={t('baseUrl')}
            type="url"
          />
          <AiProviderField
            control={control}
            name={`providers.${index}.apiType`}
            label={t('apiType')}
            options={[
              { value: 'openai-responses', label: t('responses') },
              { value: 'openai-completions', label: t('completions') },
            ]}
          />
          <AiProviderField
            control={control}
            name={`providers.${index}.apiKey`}
            label={t('apiKey')}
            type="password"
            description={t('apiKeyHint')}
          />
        </FieldGroup>
        <div className="space-y-3">
          {fields.map((field, modelIndex) => {
            const model = provider.models[modelIndex];
            if (!model) return null;
            const selected =
              isAiModelSelected(values, provider.id, model.id) ||
              isAiModelSelected(savedConfig, provider.id, model.id);
            const prefix = `providers.${index}.models.${modelIndex}` as const;
            return (
              <section
                key={field.fieldKey}
                aria-labelledby={`${field.fieldKey}-heading`}
                className="min-w-0 space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id={`${field.fieldKey}-heading`}
                    className="min-w-0 font-medium break-words"
                  >
                    {model.name || model.model || t('newModel')}
                  </h3>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving || selected || fields.length === 1}
                    onClick={() => remove(modelIndex)}
                    aria-label={t('removeModelNamed', {
                      name: model.name || t('newModel'),
                    })}
                  >
                    <Trash2 aria-hidden="true" />
                    {t('removeModel')}
                  </Button>
                </div>
                <FieldGroup className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <AiProviderField
                    control={control}
                    name={`${prefix}.name`}
                    label={t('displayName')}
                  />
                  <AiProviderField
                    control={control}
                    name={`${prefix}.model`}
                    label={t('modelId')}
                  />
                  <AiProviderField
                    control={control}
                    name={`${prefix}.reasoning`}
                    label={t('reasoning')}
                    options={[
                      { value: 'true', label: t('supported') },
                      { value: 'false', label: t('notSupported') },
                    ]}
                  />
                  <AiProviderField
                    control={control}
                    name={`${prefix}.thinkingLevel`}
                    label={t('thinkingLevel')}
                    options={AI_THINKING_LEVELS.map((level) => ({
                      value: level,
                      label: t(`levels.${level}`),
                    }))}
                  />
                  <AiProviderField
                    control={control}
                    name={`${prefix}.contextTokens`}
                    label={t('contextTokens')}
                    type="number"
                    min={8192}
                    max={2_000_000}
                  />
                  <AiProviderField
                    control={control}
                    name={`${prefix}.maxTokens`}
                    label={t('maxTokens')}
                    type="number"
                    min={1024}
                    max={1_000_000}
                  />
                </FieldGroup>
                {(selected || fields.length === 1) && (
                  <p className="text-xs text-muted-foreground">
                    {selected ? t('selectedHint') : t('lastModelHint')}
                  </p>
                )}
              </section>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => append(createAiModel(t('newModel')))}
          >
            <Plus aria-hidden="true" />
            {t('addModel')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
