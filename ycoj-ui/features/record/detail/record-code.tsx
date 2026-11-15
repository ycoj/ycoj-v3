'use client';

import CodeCopyButton from '@/shared/components/code/code-copy-button';
import CodeRenderer from '@/shared/components/code/code-renderer';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { getSyntaxLanguage } from '@/shared/lib/code-language';
import { confineSelectAllOnKeyDown } from '@/shared/lib/confine-select-all';
import { cn } from '@/shared/lib/utils';
import type { RecordDoc } from '@/shared/types/record';
import { ChevronDown, ChevronUp, Code2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';

type Props = {
  rdoc: RecordDoc;
};

export default function RecordCode({ rdoc }: Props) {
  const t = useTranslations('record');
  const contentId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const code = rdoc.code;

  useEffect(() => {
    const content = contentRef.current;
    if (!content || expanded) return;

    const observer = new ResizeObserver(() => {
      setCanExpand(content.scrollHeight > content.clientHeight);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, [code, expanded]);

  if (!code || !rdoc.lang) {
    return null;
  }

  return (
    <Card className="min-w-0 gap-0 py-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-medium">
          <Code2 className="text-muted-foreground size-4" aria-hidden="true" />
          {t('sourceCode')}
        </h2>
        <div className="flex items-center gap-1">
          {canExpand && (
            <Button
              type="button"
              variant="ghost"
              className="h-9"
              aria-expanded={expanded}
              aria-controls={contentId}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <ChevronUp /> : <ChevronDown />}
              {expanded ? t('collapseCode') : t('expandCode')}
            </Button>
          )}
          <CodeCopyButton
            text={code}
            className="static h-9 rounded-md border-0 px-2.5 py-0"
          />
        </div>
      </div>
      <CardContent className="min-w-0 px-0">
        <div
          ref={contentRef}
          id={contentId}
          role="region"
          aria-label={t('sourceCode')}
          className={cn(
            'overflow-auto focus-within:ring-ring focus-within:ring-2 focus-within:ring-inset',
            !expanded && 'max-h-[min(32rem,60dvh)]'
          )}
        >
          <CodeRenderer
            code={code}
            language={getSyntaxLanguage(rdoc.lang)}
            tabIndex={0}
            className="min-w-full w-max py-4 pr-4 text-sm leading-6 outline-none"
            onKeyDown={confineSelectAllOnKeyDown}
          />
        </div>
      </CardContent>
    </Card>
  );
}
