'use client';

import AiProviderEditor from './ai-provider-editor';
import {
  clearAiProviderKeys,
  createAiProvider,
  createAiProviderSchema,
  getAiProviderDefaults,
} from './ai-provider-form-utils';
import ClientApis from '@/api/client/method';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/shared/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/shared/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Save, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';

type Props = { config: AiProviderConfig };

export default function AiProviderForm({ config }: Props) {
  const t = useTranslations('aiProvider');
  const [savedConfig, setSavedConfig] = useState(() =>
    getAiProviderDefaults(config)
  );
  const {
    control,
    handleSubmit,
    setError,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AiProviderConfig>({
    defaultValues: getAiProviderDefaults(config),
    resolver: zodResolver(
      createAiProviderSchema({
        required: t('validation.required'),
        invalidUrl: t('validation.invalidUrl'),
        contextRange: t('validation.contextRange'),
        outputRange: t('validation.outputRange'),
        outputExceedsContext: t('validation.outputExceedsContext'),
        selectionRequired: t('validation.selectionRequired'),
        providerRequired: t('validation.providerRequired'),
      })
    ),
  });
  const values = useWatch({ control }) as AiProviderConfig;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'providers',
    keyName: 'fieldKey',
  });
  const options = values.providers.flatMap((provider) =>
    provider.models.map((model) => ({
      value: `${provider.id}:${model.id}`,
      label: `${provider.name || t('newProvider')} / ${model.name || model.model || t('newModel')}`,
    }))
  );

  const addProvider = () => {
    const provider = createAiProvider(t('newProvider'), t('newModel'));
    append(provider);
    const selection = {
      providerId: provider.id,
      modelId: provider.models[0].id,
    };
    for (const key of ['dataGeneration', 'htmlToMarkdown'] as const) {
      if (!getValues(key)) setValue(key, selection, { shouldDirty: true });
    }
  };

  const submit = async (next: AiProviderConfig) => {
    try {
      const response =
        await ClientApis.AiProvider.saveAiProviderConfig(next).send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      const saved = clearAiProviderKeys(next);
      setSavedConfig(saved);
      reset(saved);
      toast.success(t('saved'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('saveFailed');
      setError('root', { message });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      noValidate
      className="min-w-0 space-y-6"
      aria-label={t('title')}
      aria-busy={isSubmitting}
      data-llm-visible="true"
    >
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1
            className="flex items-center gap-2 text-xl font-semibold"
            data-llm-text={t('title')}
          >
            <Sparkles className="size-5" aria-hidden="true" />
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={addProvider}
        >
          <Plus aria-hidden="true" />
          {t('addProvider')}
        </Button>
      </header>
      <fieldset disabled={isSubmitting} className="min-w-0 space-y-6">
        {fields.length > 0 ? (
          <Card>
            <CardHeader>
              <h2 className="text-base font-semibold">{t('defaults')}</h2>
              <CardDescription>{t('defaultsHint')}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="grid items-start gap-5 sm:grid-cols-2">
                {(['dataGeneration', 'htmlToMarkdown'] as const).map((key) => (
                  <Controller
                    key={key}
                    control={control}
                    name={key}
                    render={({ field, fieldState }) => (
                      <Field
                        data-invalid={fieldState.invalid}
                        className="min-w-0"
                      >
                        <FieldLabel htmlFor={`ai-${key}`}>{t(key)}</FieldLabel>
                        <Select
                          value={
                            field.value
                              ? `${field.value.providerId}:${field.value.modelId}`
                              : ''
                          }
                          disabled={isSubmitting}
                          onValueChange={(value) => {
                            const [providerId, modelId] = value.split(':');
                            field.onChange({ providerId, modelId });
                          }}
                        >
                          <SelectTrigger
                            id={`ai-${key}`}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            className="w-full min-w-0"
                            aria-invalid={fieldState.invalid}
                          >
                            <SelectValue placeholder={t('chooseModel')} />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            {options.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError errors={[fieldState.error]} />
                      </Field>
                    )}
                  />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        ) : (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyTitle>{t('emptyTitle')}</EmptyTitle>
              <EmptyDescription>{t('emptyDescription')}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
        {fields.map((field, index) => (
          <AiProviderEditor
            key={field.fieldKey}
            index={index}
            control={control}
            values={values}
            savedConfig={savedConfig}
            saving={isSubmitting}
            onRemove={() => remove(index)}
          />
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-border/60 pt-5">
        <FieldError errors={[errors.root, errors.providers?.root]} />
        <Button
          type="submit"
          disabled={isSubmitting || !fields.length}
          data-llm-text={isSubmitting ? t('saving') : t('save')}
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Save aria-hidden="true" />
          )}
          {isSubmitting ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
