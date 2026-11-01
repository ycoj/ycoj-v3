'use client';

import { useCheckConn } from './use-check-conn';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { cn } from '@/shared/lib/utils';
import { AlertTriangle, RotateCw, Terminal } from 'lucide-react';
import { useTranslations } from 'next-intl';

const LEVEL_STYLES = {
  log: 'border-blue-500/60 bg-blue-500/5',
  warn: 'border-amber-500/60 bg-amber-500/5',
  error: 'border-destructive/60 bg-destructive/5',
} as const;

export default function CheckConnPanel() {
  const t = useTranslations('system');
  const { entries, status, restart } = useCheckConn();

  return (
    <Card className="min-w-0" data-llm-visible="true">
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 border-b">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Terminal className="size-4" aria-hidden="true" />
            {t('checkTitle')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('checkDescription')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={status === 'unsupported'}
          onClick={restart}
        >
          <RotateCw aria-hidden="true" />
          {t('checkRestart')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {status === 'unsupported' && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-amber-500/60 bg-amber-500/5 px-3 py-2 text-sm"
          >
            <AlertTriangle
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
            {t('checkUnsupported')}
          </p>
        )}
        {status !== 'unsupported' && (
          <p className="text-sm text-muted-foreground" role="status">
            {status === 'connecting'
              ? t('checkConnecting')
              : status === 'open'
                ? t('checkOpen')
                : status === 'failed'
                  ? t('checkFailed')
                  : t('checkClosed')}
          </p>
        )}
        {entries.length === 0 ? (
          status !== 'unsupported' && (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyTitle>{t('checkEmpty')}</EmptyTitle>
                <EmptyDescription>{t('checkDescription')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <ol className="space-y-2">
            {entries.map((entry, index) => (
              <li
                key={`${index}-${entry.level}`}
                className={cn(
                  'rounded-lg border px-3 py-2 font-mono text-xs whitespace-pre-wrap',
                  LEVEL_STYLES[entry.level]
                )}
                data-llm-text={entry.lines.join('\n')}
              >
                <span className="sr-only">{t(`levels.${entry.level}`)}</span>
                {entry.lines.join('\n')}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
