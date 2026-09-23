'use client';

import {
  formatPrintDateText,
  formatPrintDateTimeInput,
  parsePrintDateTimeInput,
} from './build-printable-contest';
import type {
  PrintableContest,
  PrintLanguageSpec,
  PrintProblemOverrides,
  PrintStatementLanguage,
} from './model';
import type { PrintContestPatch } from './print-draft';
import {
  PROBLEM_CONTENT_LANGUAGES,
  PROBLEM_LANGUAGE_LABELS,
} from '@/features/problem/parse-problem-content';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef } from 'react';

type Props = {
  /** The effective document — every field shows the built (merged) value. */
  document: PrintableContest;
  /** Sparse edits, including problems currently omitted from the paper. */
  problemOverrides: Record<number, PrintProblemOverrides>;
  /** `actions.updateContest` from `usePrintDraft`. */
  onPatch: (patch: PrintContestPatch) => void;
  onProblemPatch: (problemId: number, patch: PrintProblemOverrides) => void;
};

/**
 * Contest-level paper settings: cover metadata, statement language, notice,
 * paper options, the submission-language table, and extra markdown sections.
 */
export default function PrintContestSettings({
  document,
  problemOverrides,
  onPatch,
  onProblemPatch,
}: Props) {
  const t = useTranslations('contestPrint');
  const id = useId();
  // Removing a row unmounts the focused button; park focus on the matching
  // add control so it never falls back to <body>.
  const addLanguageRef = useRef<HTMLButtonElement>(null);

  const patchLanguage = (index: number, patch: Partial<PrintLanguageSpec>) => {
    onPatch({
      languages: document.languages.map((language, i) =>
        i === index ? { ...language, ...patch } : language
      ),
    });
  };
  const removeLanguage = (index: number) => {
    onPatch({
      languages: document.languages.filter((_, i) => i !== index),
    });
    for (const [id, override] of Object.entries(problemOverrides)) {
      if (override.submitFilenames === undefined) continue;
      onProblemPatch(Number(id), {
        submitFilenames: [
          ...override.submitFilenames.slice(0, index),
          ...override.submitFilenames.slice(index + 1),
        ],
      });
    }
    requestAnimationFrame(() => addLanguageRef.current?.focus());
  };
  const addLanguage = () => {
    onPatch({
      languages: [
        ...document.languages,
        { id: '', displayName: '', compileOptions: '' },
      ],
    });
    for (const [id, override] of Object.entries(problemOverrides)) {
      if (override.submitFilenames === undefined) continue;
      const submitFilenames = [...override.submitFilenames];
      submitFilenames[document.languages.length] = '';
      onProblemPatch(Number(id), {
        submitFilenames,
      });
    }
  };

  const setOption = (
    key: 'noiStyle' | 'fileIo' | 'usePretest',
    value: boolean
  ) => {
    onPatch(
      key === 'noiStyle'
        ? { noiStyle: value }
        : key === 'fileIo'
          ? { fileIo: value }
          : { usePretest: value }
    );
  };

  const patchDateTime = (key: 'beginAt' | 'endAt', value: string) => {
    const nextValue = parsePrintDateTimeInput(value);
    const beginAt = key === 'beginAt' ? nextValue : document.beginAt;
    const endAt = key === 'endAt' ? nextValue : document.endAt;
    onPatch({
      [key]: nextValue,
      dateText: formatPrintDateText(new Date(beginAt), new Date(endAt)),
    });
  };

  const options = [
    {
      key: 'noiStyle' as const,
      label: t('fieldNoiStyle'),
      description: t('fieldNoiStyleDescription'),
      checked: document.noiStyle,
    },
    {
      key: 'fileIo' as const,
      label: t('fieldFileIo'),
      description: t('fieldFileIoDescription'),
      checked: document.fileIo,
    },
    {
      key: 'usePretest' as const,
      label: t('fieldUsePretest'),
      description: t('fieldUsePretestDescription'),
      checked: document.usePretest,
    },
  ];

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <h2
          className="text-base leading-snug font-medium"
          data-llm-text={t('settingsTitle')}
        >
          {t('settingsTitle')}
        </h2>
        <CardDescription data-llm-text={t('settingsDescription')}>
          {t('settingsDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>{t('fieldTitle')}</FieldLabel>
            <Input
              id={`${id}-title`}
              value={document.title}
              onChange={(event) => onPatch({ title: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-subtitle`}>
              {t('fieldSubtitle')}
            </FieldLabel>
            <Input
              id={`${id}-subtitle`}
              value={document.subtitle}
              onChange={(event) => onPatch({ subtitle: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-start-time`}>
              {t('fieldStartTime')}
            </FieldLabel>
            <Input
              id={`${id}-start-time`}
              type="datetime-local"
              step="1"
              value={formatPrintDateTimeInput(document.beginAt)}
              onChange={(event) => patchDateTime('beginAt', event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-end-time`}>
              {t('fieldEndTime')}
            </FieldLabel>
            <Input
              id={`${id}-end-time`}
              type="datetime-local"
              step="1"
              value={formatPrintDateTimeInput(document.endAt)}
              onChange={(event) => patchDateTime('endAt', event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-day-name`}>
              {t('fieldDayName')}
            </FieldLabel>
            <Input
              id={`${id}-day-name`}
              value={document.dayName}
              onChange={(event) => onPatch({ dayName: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-language`}>
              {t('fieldLanguage')}
            </FieldLabel>
            <Select
              value={document.language}
              onValueChange={(value) =>
                onPatch({ language: value as PrintStatementLanguage })
              }
            >
              <SelectTrigger id={`${id}-language`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROBLEM_CONTENT_LANGUAGES.map((language) => (
                  <SelectItem key={language} value={language}>
                    {PROBLEM_LANGUAGE_LABELS[language]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{t('fieldLanguageDescription')}</FieldDescription>
          </Field>
        </div>

        <div className="space-y-3">
          {options.map((option) => (
            <Field
              key={option.key}
              orientation="horizontal"
              className="items-start"
            >
              <Checkbox
                id={`${id}-${option.key}`}
                checked={option.checked}
                onCheckedChange={(checked) =>
                  setOption(option.key, checked === true)
                }
                className="mt-0.5"
              />
              <FieldContent>
                <FieldLabel htmlFor={`${id}-${option.key}`}>
                  {option.label}
                </FieldLabel>
                <FieldDescription>{option.description}</FieldDescription>
              </FieldContent>
            </Field>
          ))}
        </div>

        <div className="space-y-2">
          <div className="space-y-1">
            <h3
              className="text-sm font-medium"
              data-llm-text={t('languagesTitle')}
            >
              {t('languagesTitle')}
            </h3>
            <p className="text-muted-foreground text-sm">
              {t('languagesDescription')}
            </p>
          </div>
          {document.languages.map((language, index) => (
            <div
              key={index}
              className="grid items-center gap-2 sm:grid-cols-[minmax(0,8rem)_minmax(0,1fr)_minmax(0,1fr)_auto]"
            >
              <Input
                aria-label={t('rowLabel', {
                  label: t('languageId'),
                  index: index + 1,
                })}
                value={language.id}
                onChange={(event) =>
                  patchLanguage(index, { id: event.target.value })
                }
              />
              <Input
                aria-label={t('rowLabel', {
                  label: t('languageName'),
                  index: index + 1,
                })}
                value={language.displayName}
                onChange={(event) =>
                  patchLanguage(index, { displayName: event.target.value })
                }
              />
              <Input
                aria-label={t('rowLabel', {
                  label: t('languageOptions'),
                  index: index + 1,
                })}
                value={language.compileOptions}
                onChange={(event) =>
                  patchLanguage(index, { compileOptions: event.target.value })
                }
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => removeLanguage(index)}
                aria-label={t('removeLanguage', { index: index + 1 })}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button
            ref={addLanguageRef}
            variant="outline"
            size="sm"
            onClick={addLanguage}
          >
            <Plus />
            {t('addLanguage')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
