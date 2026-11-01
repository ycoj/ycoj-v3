'use client';

import {
  copyProblems,
  searchCopyTargetDomains,
  type CopyDomainItem,
} from '@/api/client/method/problem/copy';
import AsyncAutoComplete from '@/shared/components/async-auto-complete';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { FieldError } from '@/shared/components/ui/field';
import { Label } from '@/shared/components/ui/label';
import { LoaderCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { useCallback, useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Props = {
  pids: number[];
  trigger: ReactNode;
  onCopied?: () => void;
};

export default function CopyProblemsDialog({ pids, trigger, onCopied }: Props) {
  const t = useTranslations('problemList.copy');
  const autoCompleteT = useTranslations('autoComplete');
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [hidden, setHidden] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const searchItems = useCallback(
    (query: string) => searchCopyTargetDomains(query),
    []
  );
  const resolveItem = useCallback(async (value: string) => {
    const items = await searchCopyTargetDomains(value);
    return items.find((item) => item._id === value) ?? null;
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setTarget('');
      setHidden(false);
      setError('');
    }
  };

  const submit = async () => {
    if (submitting) return;
    const trimmed = target.trim();
    if (!trimmed) {
      setError(t('targetRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await copyProblems(pids, trimmed, {
        hidden,
      }).send();
      if (response && 'error' in response) {
        throw new Error(parseErrorMessage(response.error));
      }
      toast.success(t('success', { count: pids.length }));
      setOpen(false);
      setTarget('');
      setHidden(false);
      onCopied?.();
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message ? caught.message : t('failed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
        <Dialog.Content
          className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border p-5 shadow-xl"
          data-llm-visible="true"
        >
          <div className="pr-10">
            <Dialog.Title
              className="text-lg font-semibold"
              data-llm-text={t('title')}
            >
              {t('title')}
            </Dialog.Title>
            <Dialog.Description
              className="text-muted-foreground mt-1 text-sm"
              data-llm-text={t('description', { count: pids.length })}
            >
              {t('description', { count: pids.length })}
            </Dialog.Description>
          </div>
          <Dialog.Close asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-4 right-4"
              aria-label={autoCompleteT('clear')}
              disabled={submitting}
            >
              <X />
            </Button>
          </Dialog.Close>

          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="copy-target-domain">{t('target')}</Label>
              <AsyncAutoComplete<CopyDomainItem>
                id="copy-target-domain"
                value={target}
                onValueChange={setTarget}
                searchItems={searchItems}
                resolveItem={resolveItem}
                itemKey={(item) => item._id}
                itemLabel={(item) => item.name || item._id}
                renderItem={(item) => (
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {item.name || item._id}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {item._id}
                    </div>
                  </div>
                )}
                messages={{
                  clear: autoCompleteT('clear'),
                  loadFailed: t('failed'),
                  loading: t('loading'),
                  noResults: t('noResults'),
                }}
                placeholder={t('targetPlaceholder')}
                ariaLabel={t('target')}
                allowEmptyQuery
                disabled={submitting}
              />
            </div>

            <Label className="gap-2">
              <Checkbox
                checked={hidden}
                onCheckedChange={(checked) => setHidden(checked === true)}
                disabled={submitting}
              />
              <span data-llm-text={t('hidden')}>{t('hidden')}</span>
            </Label>

            {error && <FieldError errors={[{ message: error }]} />}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="outline" type="button" disabled={submitting}>
                {t('cancel')}
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
            >
              {submitting && <LoaderCircle className="animate-spin" />}
              {submitting ? t('copying') : t('confirm')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
