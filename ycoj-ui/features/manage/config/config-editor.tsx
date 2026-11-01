'use client';

import { validateSystemConfig } from './config-editor-utils';
import { saveSystemConfig } from '@/api/client/method/system/config';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Field, FieldError, FieldLabel } from '@/shared/components/ui/field';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';
import { CheckCircle2, FileCode2, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  value: string;
  schema: Record<string, unknown>;
};

type Validation =
  { kind: 'idle' } | { kind: 'valid' } | { kind: 'invalid'; message: string };

export default function ConfigEditor({ value, schema }: Props) {
  const t = useTranslations('system');
  const router = useRouter();
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const [validation, setValidation] = useState<Validation>({ kind: 'idle' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const result = validateSystemConfig(draft, schema, saved);
    setValidation(
      result.kind === 'valid'
        ? { kind: 'valid' }
        : { kind: 'invalid', message: result.message }
    );
    return result.kind === 'valid';
  };

  const submit = async () => {
    setError('');
    if (!validate()) return;
    setSaving(true);
    try {
      const response = await saveSystemConfig(draft).send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      setSaved(draft);
      toast.success(t('configSaved'));
      router.refresh();
    } catch (caught) {
      if (caught instanceof SudoRedirectError) return;
      const message =
        caught instanceof Error ? caught.message : t('saveFailed');
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="min-w-0 space-y-5" data-llm-visible="true">
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          data-llm-text={t('configTitle')}
        >
          <FileCode2 className="size-5" aria-hidden="true" />
          {t('configTitle')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('configDescription')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('configSecretsHint')}
        </p>
      </header>
      <Card className="min-w-0">
        <CardHeader className="border-b">
          <h2 className="text-base font-semibold">{t('configTitle')}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field data-invalid={validation.kind === 'invalid'}>
            <FieldLabel htmlFor="system-config-value" className="sr-only">
              {t('configTitle')}
            </FieldLabel>
            <Textarea
              id="system-config-value"
              value={draft}
              disabled={saving}
              spellCheck={false}
              onChange={(event) => {
                setDraft(event.target.value);
                setValidation({ kind: 'idle' });
              }}
              className="min-h-[420px] font-mono text-xs"
              aria-label={t('configTitle')}
            />
          </Field>
          {validation.kind === 'valid' && (
            <Alert>
              <CheckCircle2 aria-hidden="true" />
              <AlertTitle>{t('configValid')}</AlertTitle>
            </Alert>
          )}
          {validation.kind === 'invalid' && (
            <Alert variant="destructive">
              <AlertTitle>{t('configInvalid')}</AlertTitle>
              <AlertDescription className="font-mono">
                {validation.message}
              </AlertDescription>
            </Alert>
          )}
          <FieldError errors={[{ message: error || undefined }]} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={validate}
            >
              {t('configValidate')}
            </Button>
            <Button
              type="button"
              disabled={saving || draft === saved}
              onClick={submit}
            >
              {saving ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <Save aria-hidden="true" />
              )}
              {saving ? t('configSaving') : t('configSave')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
