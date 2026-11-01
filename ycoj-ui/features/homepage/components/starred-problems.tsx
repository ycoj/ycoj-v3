import RecentSectionCard from './recent-section-card';
import { formatProblemPid } from '@/features/problem/lib/format-problem-pid';
import type { ListProjectionProblem } from '@/shared/types/problem';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  problems: ListProjectionProblem[];
};

export default function StarredProblems({ problems }: Props) {
  const t = useTranslations('homepage');
  if (!problems.length) return null;

  return (
    <RecentSectionCard title={t('starredProblems')} icon={Star}>
      <div className="divide-y">
        {problems.map((problem) => {
          const pid = formatProblemPid(problem);
          return (
            <p key={problem.docId} className="py-1.5 text-sm">
              <Link
                href={`/problem/${problem.pid || problem.docId}`}
                prefetch={false}
                data-llm-text={`${pid}. ${problem.title}`}
                className="hover:underline"
              >
                <span className="text-muted-foreground tabular-nums">
                  {pid}.{' '}
                </span>
                {problem.title}
              </Link>
            </p>
          );
        })}
      </div>
    </RecentSectionCard>
  );
}
