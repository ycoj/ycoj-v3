import { cn } from '@/shared/lib/utils';
import type { Node } from '@/shared/types/discussion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  vnodes: Node[];
  /** Id of the node currently shown; omit for all nodes. */
  selectedNodeId?: string;
};

export default function DiscussionNodeFilter({
  vnodes,
  selectedNodeId,
}: Props) {
  const t = useTranslations('discussion');
  if (!vnodes.length) return null;

  const items = [
    { id: undefined, title: t('allNodes'), href: '/discussion' },
    ...vnodes.map((vnode) => ({
      id: vnode.docId,
      title: vnode.title || vnode.docId,
      href: `/discussion?node=${encodeURIComponent(vnode.docId)}`,
    })),
  ];

  return (
    <nav
      aria-label={t('node')}
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      data-llm-visible="true"
    >
      {items.map((item) => {
        const active = item.id === selectedNodeId;
        return (
          <Link
            key={item.id ?? 'all'}
            href={item.href}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            data-llm-text={item.title}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-sm whitespace-nowrap transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
