'use client';

import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import type { RecordDoc } from '@/shared/types/record';
import { AnsiUp } from 'ansi_up';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

export function RecordCompilerMessage({ rdoc }: { rdoc: RecordDoc }) {
  const t = useTranslations('record');
  const text = rdoc.compilerTexts?.join('\n');
  const html = useMemo(() => {
    if (!text || !text.length) return '';
    const au = new AnsiUp();
    au.escape_html = true;
    return au.ansi_to_html(text);
  }, [text]);

  if (!rdoc.compilerTexts?.length) return null;

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <h2 className="text-base font-medium">{t('compilerOutput')}</h2>
      </CardHeader>
      <CardContent className="min-w-0">
        <pre tabIndex={0} className="max-h-64 overflow-auto text-sm">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </CardContent>
    </Card>
  );
}
