'use client';

import ClientApis from '@/api/client/method';
import type { DiscussionHistoryEntry } from '@/api/client/method/discussion/history';
import ClientMarkdown from '@/shared/components/markdown/client-markdown';
import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import dayjs from 'dayjs';
import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Props = {
  did: string;
  /** Top-level reply id; omit for the topic body. */
  drid?: string;
  /** Nested reply id; requires `drid`. */
  drrid?: string;
};

/**
 * Edit history for a topic or reply. The backend stores every version and
 * returns them newest-first through `GET /discuss/:did/…/raw?all=1`.
 */
export default function DiscussionHistoryPopover({ did, drid, drrid }: Props) {
  const t = useTranslations('discussion.history');
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<DiscussionHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (entries || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await ClientApis.Discussion.getDiscussionHistory(
        did,
        drid,
        drrid
      ).send();
      setEntries(response.history ?? []);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" className="gap-1.5">
          <History strokeWidth={2} />
          <span data-llm-text={t('edited')}>{t('edited')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <p className="text-xs font-medium" data-llm-text={t('title')}>
          {t('title')}
        </p>
        {loading && (
          <p
            className="text-muted-foreground text-xs"
            data-llm-text={t('loading')}
          >
            {t('loading')}
          </p>
        )}
        {error && (
          <p className="text-destructive text-xs" data-llm-text={error}>
            {error}
          </p>
        )}
        {!loading && !error && entries?.length === 0 && (
          <p
            className="text-muted-foreground text-xs"
            data-llm-text={t('none')}
          >
            {t('none')}
          </p>
        )}
        {entries && entries.length > 0 && (
          <ol className="max-h-72 space-y-3 overflow-auto">
            {entries.map((entry, index) => {
              const time = dayjs(entry.time);
              return (
                <li key={`${entry.time}-${index}`} className="space-y-1">
                  <p className="text-muted-foreground text-xs">
                    <span data-llm-text={t('editor')}>{t('editor')}</span>{' '}
                    <span data-llm-text={String(entry.uid)}>{entry.uid}</span>{' '}
                    <span
                      data-llm-text={
                        time.isValid() ? time.format('YYYY-MM-DD HH:mm') : ''
                      }
                    >
                      {time.isValid() ? time.format('YYYY-MM-DD HH:mm') : ''}
                    </span>
                  </p>
                  <div className="text-xs">
                    <ClientMarkdown>{entry.content}</ClientMarkdown>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </PopoverContent>
    </Popover>
  );
}
