'use client';

import { Button } from '@/shared/components/ui/button';
import { useClipboardCopy } from '@/shared/hooks/use-clipboard-copy';
import { Check, Link2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  /** Copyable path, resolved against the current origin at click time. */
  path: string;
};

export default function SolutionCopyLink({ path }: Props) {
  const t = useTranslations('solution');
  const { copied, onCopy } = useClipboardCopy(
    () => new URL(path, window.location.origin).href
  );
  const label = copied ? t('linkCopied') : t('copyLink');

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      className="text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={() => void onCopy()}
    >
      {copied ? <Check strokeWidth={2} /> : <Link2 strokeWidth={2} />}
    </Button>
  );
}
