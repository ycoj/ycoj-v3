'use client';

import { starProblem } from '@/api/client/method/problem/actions';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Props = {
  pid: string | number;
  initialStarred: boolean;
};

/**
 * Toggles the current user's star for a problem.
 *
 * The control is optimistic: the icon flips immediately and reverts if the
 * backend rejects the change.
 */
export default function ProblemStarButton({ pid, initialStarred }: Props) {
  const t = useTranslations('problemOps.star');
  const [starred, setStarred] = useState(initialStarred);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const toggle = async () => {
    if (pending) return;
    const next = !starred;
    setPending(true);
    setError('');
    setStarred(next);
    try {
      const result = await starProblem(pid, next).send();
      if ('error' in result && result.error) {
        setStarred(!next);
        setError(result.error.message ?? t('failed'));
      }
    } catch (caught) {
      setStarred(!next);
      setError(caught instanceof Error ? caught.message : t('failed'));
    } finally {
      setPending(false);
    }
  };

  const label = starred ? t('unstar') : t('star');

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={starred}
        title={label}
        disabled={pending}
        onClick={() => void toggle()}
      >
        <Star
          strokeWidth={2}
          className={cn(
            'size-5 transition-colors',
            starred && 'fill-amber-400 text-amber-500'
          )}
        />
      </Button>
      {error && (
        <p className="text-destructive max-w-40 text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
