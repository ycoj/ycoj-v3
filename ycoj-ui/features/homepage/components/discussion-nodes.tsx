import { groupDiscussionNodes } from '../homepage-status';
import RecentSectionCard from './recent-section-card';
import type { Node } from '@/shared/types/discussion';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  nodes: Node[];
};

export default function DiscussionNodes({ nodes }: Props) {
  const t = useTranslations('homepage');
  const groups = groupDiscussionNodes(nodes.filter((node) => node?.docId));
  if (!groups.length) return null;

  return (
    <RecentSectionCard title={t('discussionNodes')}>
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.category}>
            {group.category && (
              <p
                data-llm-text={group.category}
                className="text-foreground mb-1.5 text-sm font-medium"
              >
                {group.category}
              </p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {group.nodes.map((node) => (
                <Link
                  key={node.docId}
                  href={`/discussion/node/${node.docId}`}
                  prefetch={false}
                  data-llm-text={node.docId}
                  className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
                >
                  {node.docId}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </RecentSectionCard>
  );
}
