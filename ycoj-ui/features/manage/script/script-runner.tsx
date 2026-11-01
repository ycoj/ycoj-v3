'use client';

import type { ScriptListItem } from './get-script-page';
import { runSystemScript } from '@/api/client/method/system/script';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';
import { Loader2, Play, TerminalSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useState } from 'react';

type Props = { scripts: ScriptListItem[] };

function parseArgs(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return {};
  const parsed: unknown = JSON.parse(trimmed);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('object');
  }
  return parsed;
}

export default function ScriptRunner({ scripts }: Props) {
  const t = useTranslations('system');
  const router = useRouter();
  const [target, setTarget] = useState<ScriptListItem | null>(null);
  const [args, setArgs] = useState('{}');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const open = (script: ScriptListItem) => {
    setTarget(script);
    setArgs('{}');
    setError('');
  };

  const run = async () => {
    if (!target) return;
    setError('');
    try {
      parseArgs(args);
    } catch {
      setError(t('scriptArgsInvalid'));
      return;
    }
    setRunning(true);
    try {
      const response = await runSystemScript(target.id, args).send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      setTarget(null);
      if ('rid' in response && response.rid) {
        router.push(`/record/${response.rid}`);
      } else if ('url' in response && response.url) {
        router.push(response.url);
      }
    } catch (caught) {
      if (caught instanceof SudoRedirectError) return;
      setError(caught instanceof Error ? caught.message : t('scriptRunFailed'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="min-w-0 space-y-5" data-llm-visible="true">
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          data-llm-text={t('scriptTitle')}
        >
          <TerminalSquare className="size-5" aria-hidden="true" />
          {t('scriptTitle')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('scriptDescription')}
        </p>
      </header>
      {scripts.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>{t('scriptEmpty')}</EmptyTitle>
            <EmptyDescription>{t('scriptDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="min-w-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">{t('scriptId')}</TableHead>
                  <TableHead>{t('scriptDescriptionLabel')}</TableHead>
                  <TableHead className="w-24 text-right">
                    {t('scriptAction')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map((script) => (
                  <TableRow key={script.id}>
                    <TableCell className="font-mono text-xs">
                      {script.id}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {script.description || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => open(script)}
                        aria-label={`${t('scriptRun')} ${script.id}`}
                      >
                        <Play aria-hidden="true" />
                        {t('scriptRun')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog.Root
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) setTarget(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
          <Dialog.Content
            className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-xl outline-none"
            data-llm-visible="true"
          >
            <Dialog.Title className="text-lg font-semibold">
              {t('scriptDialogTitle', { id: target?.id ?? '' })}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-muted-foreground">
              {t('scriptDialogDescription')}
            </Dialog.Description>
            <form
              className="mt-4 space-y-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void run();
              }}
            >
              <Field data-invalid={Boolean(error)}>
                <FieldLabel htmlFor={`script-args-${target?.id ?? 'run'}`}>
                  {t('scriptArgs')}
                </FieldLabel>
                <Textarea
                  id={`script-args-${target?.id ?? 'run'}`}
                  value={args}
                  rows={6}
                  spellCheck={false}
                  disabled={running}
                  onChange={(event) => setArgs(event.target.value)}
                  className="font-mono text-xs"
                  aria-label={t('scriptArgs')}
                />
                <FieldDescription>{t('scriptArgs')}</FieldDescription>
                <FieldError errors={[{ message: error || undefined }]} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={running}
                  onClick={() => setTarget(null)}
                >
                  {t('scriptCancel')}
                </Button>
                <Button type="submit" disabled={running}>
                  {running ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <Play aria-hidden="true" />
                  )}
                  {running ? t('scriptRunning') : t('scriptRun')}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
}
