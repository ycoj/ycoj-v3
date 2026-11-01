'use client';

import { discussionCreatePath } from '@/features/discussion/lib/node';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import type { Node } from '@/shared/types/discussion';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Props = {
  nodes: Node[];
};

/**
 * Picks the plain discussion node to post into when the create page was opened
 * without one. Moving to the node's create path carries the choice in the URL,
 * matching the legacy `/discuss/:type/:name/create` flow.
 */
export default function DiscussionNodeSelect({ nodes }: Props) {
  const t = useTranslations('discussion.createForm');
  const router = useRouter();

  return (
    <Select
      value=""
      onValueChange={(value) =>
        router.replace(discussionCreatePath('node', value))
      }
    >
      <SelectTrigger className="w-full" aria-label={t('nodeLabel')}>
        <SelectValue placeholder={t('nodePlaceholder')} />
      </SelectTrigger>
      <SelectContent position="popper">
        {nodes.map((node) => (
          <SelectItem key={node.docId} value={node.docId}>
            {node.title || node.docId}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
