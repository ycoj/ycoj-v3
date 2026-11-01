'use client';

import { rejudgeProblem } from '@/api/client/method/problem/actions';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Button } from '@/shared/components/ui/button';
import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  /**
   * Numeric problem document id. The rejudge body validates an unsigned int,
   * so a string PID such as `P1000` must not be used here.
   */
  docId: number;
  tid?: string;
};

/**
 * Rejudges every submission of one problem.
 *
 * The backend re-queues all normal submissions and returns a redirect; the
 * page is refreshed afterwards so the visible queue state stays truthful.
 */
export default function ProblemRejudgeButton({ docId, tid }: Props) {
  const t = useTranslations('problemOps.rejudge');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const rejudge = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const result = await rejudgeProblem(docId, tid).send();
      if ('error' in result && result.error) {
        setError(parseErrorMessage(result.error) || t('failed'));
        return;
      }
      toast.success(t('queued'));
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        setError('');
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full justify-start gap-3 px-4"
        >
          <RotateCw strokeWidth={2} />
          <span data-llm-text={t('title')}>{t('title')}</span>
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 outline-none">
          <AlertDialog.Title
            className="text-lg font-semibold"
            data-llm-text={t('title')}
          >
            {t('title')}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-muted-foreground mt-2 text-sm">
            {t('confirm')}
          </AlertDialog.Description>
          {error && (
            <p className="text-destructive mt-3 text-sm" role="alert">
              {error}
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="outline" disabled={pending}>
                {t('cancel')}
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void rejudge()}
            >
              {pending ? t('rejudging') : t('confirmAction')}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
