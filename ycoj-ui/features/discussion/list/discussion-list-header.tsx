import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  title: string;
  subtitle?: string;
  /** Shown above the title when the list is scoped to a resource. */
  backHref?: string;
  /** Omit when the viewer cannot create discussions. */
  createHref?: string;
};

export default function DiscussionListHeader({
  title,
  subtitle,
  backHref,
  createHref,
}: Props) {
  const t = useTranslations('discussion');

  return (
    <header
      className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3"
      data-llm-visible="true"
    >
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
        <h1
          className="text-xl leading-tight font-semibold md:text-2xl"
          data-llm-text={title}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground text-sm" data-llm-text={subtitle}>
            {subtitle}
          </p>
        )}
      </div>
      {createHref && (
        <Button asChild className="gap-2">
          <Link href={createHref} prefetch={false}>
            <Plus strokeWidth={2} />
            <span data-llm-text={t('create')}>{t('create')}</span>
          </Link>
        </Button>
      )}
    </header>
  );
}
