import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/utils';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  /** Shown only when the list is scoped to a resource. */
  title?: string;
  /** Shown above the title when the list is scoped to a resource. */
  backHref?: string;
  /** Omit when the viewer cannot create discussions. */
  createHref?: string;
  /** Toolbar content, such as the node filter, shown before the create action. */
  children?: ReactNode;
};

export default function DiscussionListHeader({
  title,
  backHref,
  createHref,
  children,
}: Props) {
  const t = useTranslations('discussion');
  const hasHeading = Boolean(title || backHref);

  return (
    <header
      className={cn(
        'flex flex-wrap justify-between gap-x-4 gap-y-3',
        hasHeading ? 'items-end' : 'items-center'
      )}
      data-llm-visible="true"
    >
      {hasHeading && (
        <div className="min-w-0 space-y-1">
          {backHref && (
            <Link
              href={backHref}
              prefetch={false}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
            >
              <ArrowLeft className="size-3.5" />
              <span data-llm-text={t('backToList')}>{t('backToList')}</span>
            </Link>
          )}
          {title && (
            <h1
              className="text-xl leading-tight font-semibold md:text-2xl"
              data-llm-text={title}
            >
              {title}
            </h1>
          )}
        </div>
      )}
      {children && <div className="min-w-0 flex-1">{children}</div>}
      {createHref && (
        <Button asChild className="shrink-0 gap-2">
          <Link href={createHref} prefetch={false}>
            <Plus strokeWidth={2} />
            <span data-llm-text={t('create')}>{t('create')}</span>
          </Link>
        </Button>
      )}
    </header>
  );
}
