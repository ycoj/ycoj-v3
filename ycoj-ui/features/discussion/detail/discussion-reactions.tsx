'use client';

import ClientApis from '@/api/client/method';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { cn } from '@/shared/lib/utils';
import { SmilePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * The backend's `Types.Emoji` accepts any emoji; the picker mirrors the legacy
 * `UiContext.emojiList` default list.
 */
const DEFAULT_EMOJIS = [
  '👍',
  '👎',
  '😄',
  '😕',
  '❤️',
  '🤔',
  '🤣',
  '🌿',
  '🍋',
  '🕊️',
  '👀',
  '🤡',
];

type Props = {
  did: string;
  /** `did` for the topic, `drid` for a top-level reply. Nested replies have no reactions. */
  nodeType: 'did' | 'drid';
  id: string;
  reactions: Record<string, number>;
  /** Emoji the viewer already reacted with. */
  ownReactions: Record<string, number>;
  canReact: boolean;
};

export default function DiscussionReactions({
  did,
  nodeType,
  id,
  reactions,
  ownReactions,
  canReact,
}: Props) {
  const t = useTranslations('discussion.reactions');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');

  const active = Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const toggle = async (emoji: string, reverse: boolean) => {
    if (pending) return;
    setPending(emoji);
    setError('');
    try {
      const response = await ClientApis.Discussion.reactToDiscussion(
        did,
        nodeType,
        id,
        emoji,
        reverse
      ).send();
      if ('error' in response) {
        setError(
          (response.error && parseErrorMessage(response.error)) || t('failed')
        );
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('failed'));
    } finally {
      setPending(null);
    }
  };

  if (!canReact && !active.length) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      data-llm-visible="true"
    >
      {active.map(([emoji, count]) => {
        const mine = !!ownReactions[emoji];
        return (
          <button
            key={emoji}
            type="button"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors',
              mine
                ? 'border-primary/40 bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground'
            )}
            disabled={!canReact || pending !== null}
            aria-pressed={mine}
            aria-label={`${emoji} ${count}`}
            onClick={() => void toggle(emoji, mine)}
            data-llm-text={`${emoji} ${count}`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span className="tabular-nums">{count}</span>
          </button>
        );
      })}
      {canReact && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="text-muted-foreground"
              aria-label={t('add')}
              title={t('add')}
            >
              <SmilePlus strokeWidth={2} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <div className="grid grid-cols-6 gap-1">
              {DEFAULT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={cn(
                    'flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted',
                    pending === emoji && 'opacity-50'
                  )}
                  disabled={pending !== null}
                  aria-label={emoji}
                  onClick={() => void toggle(emoji, !!ownReactions[emoji])}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      {error && (
        <p className="text-destructive text-xs" data-llm-text={error}>
          {error}
        </p>
      )}
    </div>
  );
}
