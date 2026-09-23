'use client';

import type {
  PrintLanguageSpec,
  PrintProblem,
  PrintProblemOverrides,
} from './model';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';

type Props = {
  /** Effective problem values (defaults merged with overrides). */
  problem: PrintProblem;
  /** CNOI letter for this position, e.g. `A`. */
  letter: string;
  isFirst: boolean;
  isLast: boolean;
  /** Whether the paper uses NOI-style directory/executable fields. */
  showNoiStyle: boolean;
  /** Whether the paper describes file I/O — gates the file name fields. */
  showFileIo: boolean;
  /** Whether the paper prints pretest rows — gates the pretest field. */
  showPretest: boolean;
  /** Submission-table languages; labels the per-language file name inputs. */
  languages: PrintLanguageSpec[];
  /** Whether this problem has any overrides (drives the badge/restore). */
  hasOverrides: boolean;
  onPatch: (patch: PrintProblemOverrides) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onRestore: () => void;
};

/**
 * One problem card in the print order: a summary header with per-card
 * actions, a collapsible editor for the printed fields, and an advanced
 * section for directory/executable/submission-name details.
 */
export default function PrintProblemEditor({
  problem,
  letter,
  isFirst,
  isLast,
  showNoiStyle,
  showFileIo,
  showPretest,
  languages,
  hasOverrides,
  onPatch,
  onMoveUp,
  onMoveDown,
  onRemove,
  onRestore,
}: Props) {
  const t = useTranslations('contestPrint');
  const id = useId();
  const [advanced, setAdvanced] = useState(false);
  const advancedId = `${id}-advanced`;

  const limits = [problem.timeLimit, problem.memoryLimit]
    .filter(Boolean)
    .join(' · ');

  const patchFilename = (index: number, value: string) => {
    onPatch({
      submitFilenames: languages.map((_, i) =>
        i === index ? value : (problem.submitFilenames[i] ?? '')
      ),
    });
  };

  const patchName = (name: string) => {
    onPatch(
      advanced
        ? { name }
        : {
            name,
            directory: name,
            executable: name,
            inputFile: `${name}.in`,
            outputFile: `${name}.out`,
          }
    );
  };

  const toggleAdvanced = () => {
    if (advanced) {
      onPatch({
        directory: problem.name,
        executable: problem.name,
        inputFile: `${problem.name}.in`,
        outputFile: `${problem.name}.out`,
      });
    }
    setAdvanced((current) => !current);
  };

  return (
    <Card size="sm" data-llm-visible="true">
      <div className="flex items-start gap-2 px-3">
        <Badge variant="secondary" className="mt-0.5">
          {letter}
        </Badge>
        <div className="min-w-0 flex-1">
          <h3
            className="truncate text-sm font-medium"
            data-llm-text={problem.title}
          >
            {problem.title}
          </h3>
          <p className="text-muted-foreground truncate text-xs">
            #{problem.problemId}
            {problem.pid ? ` · ${problem.pid}` : ''}
            {limits ? ` · ${limits}` : ''}
          </p>
        </div>
        {hasOverrides && (
          <Badge variant="outline" className="mt-0.5">
            {t('modifiedBadge')}
          </Badge>
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={t('moveUp', { letter })}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={t('moveDown', { letter })}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRestore}
            disabled={!hasOverrides}
            aria-label={t('restoreProblem', { letter })}
          >
            <RotateCcw />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRemove}
            aria-label={t('removeProblem', { letter })}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      <CardContent className="space-y-4 border-t pt-3">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${id}-title`}>
              {t('fieldProblemTitle')}
            </FieldLabel>
            <Input
              id={`${id}-title`}
              value={problem.title}
              onChange={(event) => onPatch({ title: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>
              {t('fieldProblemName')}
            </FieldLabel>
            <Input
              id={`${id}-name`}
              value={problem.name}
              onChange={(event) => patchName(event.target.value)}
            />
            <FieldDescription>
              {t('fieldProblemNameDescription')}
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-type`}>
              {t('fieldProblemType')}
            </FieldLabel>
            <Input
              id={`${id}-type`}
              value={problem.problemType}
              onChange={(event) => onPatch({ problemType: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor={`${id}-time`}>
              {t('fieldTimeLimit')}
            </FieldLabel>
            <Input
              id={`${id}-time`}
              value={problem.timeLimit}
              onChange={(event) => onPatch({ timeLimit: event.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-memory`}>
              {t('fieldMemoryLimit')}
            </FieldLabel>
            <Input
              id={`${id}-memory`}
              value={problem.memoryLimit}
              onChange={(event) => onPatch({ memoryLimit: event.target.value })}
            />
          </Field>
        </div>

        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5"
            onClick={toggleAdvanced}
            aria-expanded={advanced}
            aria-controls={advancedId}
          >
            {advanced ? <ChevronUp /> : <ChevronDown />}
            {t('advancedTitle')}
          </Button>
          {advanced && (
            <div id={advancedId} className="mt-2 space-y-4">
              {showNoiStyle && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${id}-directory`}>
                      {t('fieldDirectory')}
                    </FieldLabel>
                    <Input
                      id={`${id}-directory`}
                      value={problem.directory}
                      onChange={(event) =>
                        onPatch({ directory: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-executable`}>
                      {t('fieldExecutable')}
                    </FieldLabel>
                    <Input
                      id={`${id}-executable`}
                      value={problem.executable}
                      onChange={(event) =>
                        onPatch({ executable: event.target.value })
                      }
                    />
                  </Field>
                </div>
              )}

              {showFileIo && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`${id}-input`}>
                      {t('fieldInputFile')}
                    </FieldLabel>
                    <Input
                      id={`${id}-input`}
                      value={problem.inputFile}
                      onChange={(event) =>
                        onPatch({ inputFile: event.target.value })
                      }
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-output`}>
                      {t('fieldOutputFile')}
                    </FieldLabel>
                    <Input
                      id={`${id}-output`}
                      value={problem.outputFile}
                      onChange={(event) =>
                        onPatch({ outputFile: event.target.value })
                      }
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor={`${id}-testcases`}>
              {t('fieldTestcaseCount')}
            </FieldLabel>
            <Input
              id={`${id}-testcases`}
              value={problem.testcaseCount}
              onChange={(event) =>
                onPatch({ testcaseCount: event.target.value })
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-score`}>
              {t('fieldScoreNote')}
            </FieldLabel>
            <Input
              id={`${id}-score`}
              value={problem.scoreNote}
              onChange={(event) => onPatch({ scoreNote: event.target.value })}
            />
          </Field>
          {showPretest && (
            <Field>
              <FieldLabel htmlFor={`${id}-pretest`}>
                {t('fieldPretestCount')}
              </FieldLabel>
              <Input
                id={`${id}-pretest`}
                value={problem.pretestCount}
                onChange={(event) =>
                  onPatch({ pretestCount: event.target.value })
                }
              />
            </Field>
          )}
        </div>

        {languages.length > 0 && (
          <div className="space-y-2">
            <Label className="text-muted-foreground">
              {t('submitFilenames')}
            </Label>
            {languages.map((language, index) => (
              <div
                key={language.id || index}
                className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-2"
              >
                <span className="text-muted-foreground truncate text-xs">
                  {language.displayName || language.id}
                </span>
                <Input
                  aria-label={t('submitFilenameFor', {
                    language: language.displayName || language.id || index + 1,
                  })}
                  value={problem.submitFilenames[index] ?? ''}
                  onChange={(event) => patchFilename(index, event.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
