'use client';

import {
  HACK_INPUT_FILE_LIMIT,
  submitProblemHack,
} from '@/api/client/method/problem/hack';
import { formatSizeLimit } from '@/features/problem/submit/submit-mode';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Send, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

type Props = {
  pid: string | number;
  rid: string;
  tid?: string;
};

/**
 * Hack submission form.
 *
 * The backend accepts either pasted input or a file up to 2 MiB and rejects
 * the request with a descriptive `HackFailedError`; those messages are shown
 * inline so the user can correct the input.
 */
export default function ProblemHackForm({ pid, rid, tid }: Props) {
  const t = useTranslations('problemOps.hack');
  const router = useRouter();
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [autoOrganize, setAutoOrganize] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectFile = (next: File | null) => {
    setError('');
    if (next && next.size > HACK_INPUT_FILE_LIMIT) {
      setError(
        t('fileTooLarge', { limit: formatSizeLimit(HACK_INPUT_FILE_LIMIT) })
      );
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    setFile(next);
  };

  const submit = async () => {
    if (pending) return;
    if (!file && !input.trim()) {
      setError(t('inputRequired'));
      return;
    }

    setPending(true);
    setError('');
    try {
      const result = await submitProblemHack(pid, rid, {
        input: file ? undefined : input,
        file,
        autoOrganizeInput: autoOrganize,
        tid,
      }).send();

      if ('error' in result && result.error) {
        setError(parseErrorMessage(result.error));
        return;
      }
      if (result.rid) {
        router.push(`/record/${result.rid}`);
        return;
      }
      setError(t('failed'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="space-y-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="hack-input">{t('input')}</FieldLabel>
          <FieldContent>
            <Textarea
              id="hack-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t('inputPlaceholder')}
              className="min-h-60 font-mono"
              spellCheck={false}
              disabled={pending || Boolean(file)}
              aria-invalid={Boolean(error) && !file}
            />
          </FieldContent>
        </Field>

        <Field>
          <FieldLabel htmlFor="hack-file">{t('inputFile')}</FieldLabel>
          <FieldContent>
            <div className="flex items-center gap-2">
              <Input
                id="hack-file"
                ref={inputRef}
                type="file"
                disabled={pending}
                onChange={(event) =>
                  selectFile(event.target.files?.[0] ?? null)
                }
              />
              {file && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('removeFile')}
                  disabled={pending}
                  onClick={() => {
                    selectFile(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                >
                  <X strokeWidth={2} />
                </Button>
              )}
            </div>
            <p className="text-muted-foreground text-xs">
              {t('fileHint', {
                limit: formatSizeLimit(HACK_INPUT_FILE_LIMIT),
              })}
            </p>
          </FieldContent>
        </Field>

        <div className="flex items-start gap-2">
          <Checkbox
            id="hack-auto-organize"
            checked={autoOrganize}
            onCheckedChange={(checked) => setAutoOrganize(checked === true)}
            disabled={pending || Boolean(file)}
          />
          <div className="space-y-1">
            <Label htmlFor="hack-auto-organize" className="text-sm">
              {t('autoOrganize')}
            </Label>
            <p className="text-muted-foreground text-xs">
              {t('autoOrganizeHint')}
            </p>
          </div>
        </div>
      </FieldGroup>

      {error && <FieldError errors={[{ message: error }]} />}

      <Button type="submit" size="lg" className="w-36 gap-3" disabled={pending}>
        <Send strokeWidth={2} data-icon="inline-start" />
        {pending ? t('submitting') : t('submit')}
      </Button>

      {file && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <Upload strokeWidth={2} className="size-3" />
          {file.name}
        </p>
      )}
    </form>
  );
}
