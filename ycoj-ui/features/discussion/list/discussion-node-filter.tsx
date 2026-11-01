'use client';

import { discussionCreatePath } from '@/features/discussion/lib/node';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { Node } from '@/shared/types/discussion';
import { Plus, Tag } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

type Props = {
  vnodes: Node[];
  /** Resource node currently shown, when the page is scoped to one. */
  selectedNodeId?: string;
  /** Path of the resource create page, for `/discussion/:type/:name`. */
  createHref?: string;
  /** Whether to show the create entry for the selected node. */
  canCreate?: boolean;
};

export default function DiscussionNodeFilter({
  vnodes,
  selectedNodeId,
  createHref,
  canCreate = true,
}: Props) {
  const t = useTranslations('discussion');
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentNode = selectedNodeId ?? searchParams.get('node') ?? 'all';

  const nodeOptions = useMemo(() => {
    return vnodes.map((vnode) => ({
      id: vnode.docId,
      title: vnode.title ?? vnode.docId,
    }));
  }, [vnodes]);

  const handleNodeChange = (value: string) => {
    if (value === 'all') {
      router.push('/discussion');
      return;
    }
    if (selectedNodeId) {
      // A resource node is not part of the plain node select; keep this page.
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('node', value);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select value={currentNode} onValueChange={handleNodeChange}>
        <SelectTrigger className="w-64 min-w-[256px]">
          <div className="flex items-center gap-2">
            <Tag className="size-4 text-muted-foreground" />
            <SelectValue placeholder={t('node')} />
          </div>
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value="all">{t('allNodes')}</SelectItem>
          {nodeOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {currentNode !== 'all' && canCreate && (
        <Button asChild className="ml-auto">
          <Link
            href={createHref ?? discussionCreatePath('node', currentNode)}
            className="gap-2"
            prefetch={false}
          >
            <Plus strokeWidth={2} />
            {t('create')}
          </Link>
        </Button>
      )}
    </div>
  );
}
