'use client';

import ClientApis from '@/api/client/method';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Button } from '@/shared/components/ui/button';
import { RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertDialog } from 'radix-ui';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = { tid: string };

export default function ContestRejudge({ tid }: Props) {
  const t = useTranslations('contestManagement');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const rejudge = async () => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const result = await ClientApis.Contest.rejudgeContest(tid).send();
      if ('error' in result) {
        setError(parseErrorMessage(result.error) || t('actionFailed'));
        return;
      }
      toast.success(t('rejudgeQueued', { count: result.count }));
      setOpen(false);
      router.refresh();
    } catch {
      setError(t('actionFailed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(value) => {
        if (pending) return;
        setOpen(value);
        setError('');
      }}
    >
      <AlertDialog.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-10 w-full justify-start gap-3 px-4"
          disabled={pending}
        >
          <RotateCw strokeWidth={2} />
          <span data-llm-text={t('rejudgeTitle')}>{t('rejudgeTitle')}</span>
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AlertDialog.Content className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 outline-none">
          <AlertDialog.Title className="text-lg font-semibold">
            {t('rejudgeAll')}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground">
            {t('confirmRejudge')}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
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
              {pending ? t('rejudgePending') : t('confirmRejudgeAction')}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
