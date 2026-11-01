'use client';

import ClientApis from '@/api/client/method';
import { submitProblemFile } from '@/api/client/method/problem/submit-file';
import type { ProblemDetailMode } from '@/api/server/method/problems/detail';
import type { LanguageFamily } from '@/api/server/method/ui/languages';
import { getContestEndedVariant } from '@/features/problem/detail/contest-ended-mode';
import ContestEndedNotice from '@/features/problem/detail/contest-ended-notice';
import {
  formatSizeLimit,
  normalizeAppUrl,
  resolvePreferredSelection,
  resolveSubmitMode,
} from '@/features/problem/submit/submit-mode';
import CodeEditor from '@/shared/components/code/code-editor';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { useCodeEditorPreference } from '@/shared/hooks/use-code-editor-preference';
import { getSyntaxLanguage } from '@/shared/lib/code-language';
import type { PublicProjectionProblem } from '@/shared/types/problem';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Navigation, Link2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

type Props = {
  pid: string;
  tid?: string;
  problem: Pick<PublicProjectionProblem, 'config'>;
  languages: Record<string, LanguageFamily>;
  /** Account preference from `UserContext.codeLang`. */
  preferredLanguage?: string;
  /** Account preference from `UserContext.codeTemplate`. */
  codeTemplate?: string;
  contestEndedMode?: ProblemDetailMode;
};

type FormValues = {
  familyKey: string;
  lang: string;
  code: string;
  fileName: string;
};

export default function ProblemSubmitFormClient({
  pid,
  tid,
  problem,
  languages,
  preferredLanguage,
  codeTemplate,
  contestEndedMode,
}: Props) {
  const t = useTranslations('problem.submitForm');
  const tProblem = useTranslations('problem');
  const isContestEnded = Boolean(getContestEndedVariant(contestEndedMode));
  const router = useRouter();
  const [codeEditorEnabled, setCodeEditorEnabled] = useCodeEditorPreference();
  const modeInfo = useMemo(() => resolveSubmitMode(problem), [problem]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The selected file is form state, not a ref: submission reads it during an
  // event handler and the rendered file name must stay in sync with it.
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Account preference wins over the built-in C++14 default; a stored
  // practice-workspace choice is out of scope here because this standalone
  // form never reads the scratchpad draft.
  const preferredSelection = useMemo(
    () => resolvePreferredSelection(languages, preferredLanguage),
    [languages, preferredLanguage]
  );
  const defaultFamilyKey = preferredSelection.familyKey;
  const defaultLang = preferredSelection.lang;

  const schema = useMemo(
    () =>
      z
        .object({
          familyKey: z.string(),
          lang: z.string(),
          code: z.string(),
          fileName: z.string(),
        })
        .superRefine((values, ctx: z.RefinementCtx) => {
          const needsFile = modeInfo.mode === 'answer';
          if (!values.fileName && !needsFile && !values.code.trim()) {
            ctx.addIssue({
              code: 'custom',
              path: ['code'],
              message: t('enterCode'),
            });
            return;
          }
          if (needsFile && !values.fileName) {
            ctx.addIssue({
              code: 'custom',
              path: ['fileName'],
              message: t('selectFile'),
            });
            return;
          }
          if (!values.fileName && values.code.length > modeInfo.codeLimit) {
            ctx.addIssue({
              code: 'custom',
              path: ['code'],
              message: t('codeTooLong', {
                limit: modeInfo.codeLimit.toLocaleString(),
              }),
            });
            return;
          }
          if (modeInfo.fixedLanguage) return;

          const family = languages[values.familyKey];
          if (!family) {
            ctx.addIssue({
              code: 'custom',
              path: ['familyKey'],
              message: t('selectLanguage'),
            });
            return;
          }
          if (
            !family.versions.some((version) => version.name === values.lang)
          ) {
            ctx.addIssue({
              code: 'custom',
              path: ['lang'],
              message: t('selectVersion'),
            });
          }
        }),
    [languages, modeInfo, t]
  );

  const {
    control,
    getValues,
    setValue,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      familyKey: defaultFamilyKey,
      lang: defaultLang,
      code: codeTemplate ?? '',
      fileName: '',
    },
  });

  const familyKey = useWatch({ control, name: 'familyKey' }) ?? '';
  const selectedFamily = familyKey ? languages[familyKey] : undefined;
  const fileName = useWatch({ control, name: 'fileName' }) ?? '';
  const hasFile = Boolean(fileName);

  useEffect(() => {
    if (getValues('familyKey')) return;
    if (!defaultFamilyKey) return;

    setValue('familyKey', defaultFamilyKey, { shouldValidate: true });
    setValue('lang', defaultLang, { shouldValidate: true });
  }, [defaultFamilyKey, defaultLang, getValues, setValue]);

  useEffect(() => {
    const currentLang = getValues('lang');
    const versions = selectedFamily?.versions ?? [];

    if (!selectedFamily) {
      if (currentLang) setValue('lang', '', { shouldValidate: true });
      return;
    }

    if (versions.some((version) => version.name === currentLang)) return;
    setValue('lang', versions[0]?.name ?? '', { shouldValidate: true });
  }, [familyKey, getValues, selectedFamily, setValue]);

  const handleFileChange = (file: File | null) => {
    setSelectedFile(file);
    setValue('fileName', file?.name ?? '', { shouldValidate: true });
    if (!file) clearErrors('fileName');
  };

  const onSubmit = async (values: FormValues) => {
    const file = selectedFile;

    if (file && file.size > modeInfo.fileLimit) {
      setError('fileName', {
        type: 'manual',
        message: t('fileTooLarge', {
          limit: formatSizeLimit(modeInfo.fileLimit),
        }),
      });
      return;
    }

    try {
      const lang = modeInfo.fixedLanguage ? '_' : values.lang;
      const res = file
        ? await submitProblemFile(pid, file, { lang, tid }).send()
        : await ClientApis.Problem.submitProblem(
            pid,
            { lang, code: values.code },
            tid
          ).send();

      if (res?.rid) {
        router.push(`/record/${res.rid}`);
        return;
      }
      if (res?.tid) {
        router.push(`/contest/${res.tid}`);
        return;
      }
      const fallbackUrl = normalizeAppUrl(res?.url);
      if (fallbackUrl) {
        router.push(fallbackUrl);
        return;
      }

      setError('root.serverError', {
        type: 'server',
        message: res?.error ? parseErrorMessage(res.error) : t('submitFailed'),
      });
    } catch (error) {
      setError('root.serverError', {
        type: 'server',
        message: error instanceof Error ? error.message : t('submitRetry'),
      });
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
      {isContestEnded && <ContestEndedNotice mode={contestEndedMode} />}

      <FieldGroup>
        {!modeInfo.fixedLanguage && (
          <div className="flex flex-wrap gap-6">
            <Controller
              control={control}
              name="familyKey"
              render={({ field }) => (
                <Field className="w-auto flex-none">
                  <FieldLabel htmlFor="family-select">
                    {t('language')}
                  </FieldLabel>
                  <FieldContent>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isSubmitting || isContestEnded}
                    >
                      <SelectTrigger
                        id="family-select"
                        aria-invalid={!!errors.familyKey}
                        className="w-60"
                      >
                        <SelectValue placeholder={t('selectLanguage')} />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(languages).map(([key, fam]) => (
                          <SelectItem key={key} value={key}>
                            {fam.display}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[errors.familyKey]} />
                  </FieldContent>
                </Field>
              )}
            />

            <Controller
              control={control}
              name="lang"
              render={({ field }) => (
                <Field className="w-auto flex-none">
                  <FieldLabel htmlFor="version-select">
                    {t('version')}
                  </FieldLabel>
                  <FieldContent>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={
                        !selectedFamily || isSubmitting || isContestEnded
                      }
                    >
                      <SelectTrigger
                        id="version-select"
                        aria-invalid={!!errors.lang}
                        className="w-60"
                      >
                        <SelectValue placeholder={t('selectVersion')} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedFamily?.versions.map((version) => (
                          <SelectItem key={version.name} value={version.name}>
                            {version.display}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError errors={[errors.lang]} />
                  </FieldContent>
                </Field>
              )}
            />
          </div>
        )}

        {modeInfo.mode === 'code' && (
          <Field>
            <FieldLabel>{t('code')}</FieldLabel>
            <FieldContent>
              <Controller
                control={control}
                name="code"
                render={({ field }) =>
                  codeEditorEnabled === true ? (
                    <CodeEditor
                      value={field.value}
                      onChange={field.onChange}
                      language={getSyntaxLanguage(familyKey) || undefined}
                      height="480px"
                      readOnly={isSubmitting || isContestEnded || hasFile}
                      invalid={!!errors.code}
                      ariaLabel={t('code')}
                    />
                  ) : (
                    <Textarea
                      value={field.value}
                      onChange={(event) => field.onChange(event.target.value)}
                      placeholder={t('codePlaceholder')}
                      aria-label={t('code')}
                      aria-invalid={!!errors.code}
                      disabled={isSubmitting || isContestEnded || hasFile}
                      className="min-h-120 font-mono"
                    />
                  )
                }
              />
              <FieldError errors={[errors.code]} />
            </FieldContent>
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor="solution-file">
            {modeInfo.mode === 'answer' ? t('answerFile') : t('sourceFile')}
          </FieldLabel>
          <FieldContent>
            <div
              className="flex min-h-20 items-center gap-3 rounded-lg border border-dashed px-4 py-3"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (isSubmitting || isContestEnded) return;
                handleFileChange(event.dataTransfer.files?.[0] ?? null);
              }}
            >
              <FileUp className="text-muted-foreground size-6 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {fileName || t('dropFileHere')}
                </p>
                <Input
                  id="solution-file"
                  ref={fileInputRef}
                  type="file"
                  className="mt-2 h-8"
                  aria-invalid={!!errors.fileName}
                  disabled={isSubmitting || isContestEnded}
                  onChange={(event) =>
                    handleFileChange(event.target.files?.[0] ?? null)
                  }
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  {modeInfo.mode === 'answer'
                    ? t('answerFileHint', {
                        limit: formatSizeLimit(modeInfo.fileLimit),
                      })
                    : t('sourceFileHint', {
                        limit: formatSizeLimit(modeInfo.fileLimit),
                      })}
                </p>
              </div>
              {hasFile && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={t('removeFile')}
                  disabled={isSubmitting || isContestEnded}
                  onClick={() => {
                    handleFileChange(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <X strokeWidth={2} />
                </Button>
              )}
            </div>
            <FieldError errors={[errors.fileName]} />
          </FieldContent>
        </Field>
      </FieldGroup>

      <FieldError errors={[errors.root?.serverError]} />

      {modeInfo.mode === 'code' && (
        <div className="-mt-3 flex items-center gap-2">
          <Checkbox
            id="use-code-editor"
            checked={codeEditorEnabled === true}
            onCheckedChange={(checked) =>
              setCodeEditorEnabled(checked === true)
            }
            disabled={isSubmitting || isContestEnded || hasFile}
          />
          <Label htmlFor="use-code-editor" className="text-sm">
            {t('useCodeEditor')}
          </Label>
        </div>
      )}

      {!isContestEnded ? (
        <Button
          size="lg"
          type="submit"
          className="w-30 gap-3"
          disabled={isSubmitting}
        >
          <Navigation strokeWidth={2} data-icon="inline-start" />
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      ) : (
        <Button size="lg" asChild className="w-auto gap-3">
          <Link href={`/problem/${pid}`}>
            <Link2 strokeWidth={2} data-icon="inline-start" />
            {tProblem('openInProblemSet')}
          </Link>
        </Button>
      )}
    </form>
  );
}
