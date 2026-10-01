'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export default function DrawLoading() {
  const t = useTranslations('common');

  return (
    <div
      className="flex size-full items-center justify-center gap-2 text-muted-foreground"
      role="status"
    >
      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      <span>{t('loading')}</span>
    </div>
  );
}
