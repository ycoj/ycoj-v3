import { formatProblemPid } from '@/features/problem/lib/format-problem-pid';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  PROBLEMS_DIFFICULTY_COLOR,
  PROBLEMS_DIFFICULTY_KEYS,
} from '@/shared/configs/difficulty';
import {
  STATUS_BACKGROUND_COLOR,
  STATUS_TEXT_KEYS,
} from '@/shared/configs/status';
import type {
  ListProjectionProblem,
  ProblemStatus as ProblemStatusDoc,
  ProblemStatusDict,
} from '@/shared/types/problem';
import { CircleCheck, ListChecks, Send, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Props = {
  problems: ListProjectionProblem[];
  psdict: ProblemStatusDict;
};

const MAX_PROBLEM_DIFFICULTY = 8;
const FALLBACK_STATUS_COLOR = '#6b7280';

function MetaItem({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-0.5" title={label}>
      <Icon className="size-3" />
      <span className="tabular-nums">{children}</span>
    </span>
  );
}

/** Difficulty as a colored dot: the full label is too wide for one row. */
function DifficultyDot({ difficulty }: { difficulty?: number }) {
  const t = useTranslations('difficulty');
  const level =
    typeof difficulty === 'number' &&
    difficulty >= 0 &&
    difficulty <= MAX_PROBLEM_DIFFICULTY
      ? difficulty
      : 0;
  const label = t(PROBLEMS_DIFFICULTY_KEYS[level]);

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-llm-text={label}
      className="size-2 shrink-0 rounded-full"
      style={{ backgroundColor: PROBLEMS_DIFFICULTY_COLOR[level] }}
    />
  );
}

/** The viewer's result for a problem they have already touched. */
function StatusDot({ status }: { status: ProblemStatusDoc }) {
  const t = useTranslations('judgeStatus.label');
  if (status.status === undefined || status.status === null) return null;
  const statusKey = STATUS_TEXT_KEYS[status.status];
  const label = statusKey ? t(statusKey) : undefined;
  if (!label) return null;

  const color =
    STATUS_BACKGROUND_COLOR[
      status.status as keyof typeof STATUS_BACKGROUND_COLOR
    ] || FALLBACK_STATUS_COLOR;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-llm-text={label}
      className="size-2 shrink-0 rounded-full ring-2 ring-inset ring-current/40"
      style={{ backgroundColor: color, color }}
    />
  );
}

function ProblemRow({
  problem,
  status,
}: {
  problem: ListProjectionProblem;
  status?: ProblemStatusDoc;
}) {
  const t = useTranslations('problem');
  const pid = formatProblemPid(problem);

  return (
    <div
      data-llm-visible="true"
      className="flex min-w-0 items-center gap-2 py-1.5"
    >
      <Link
        href={`/problem/${problem.pid || problem.docId}`}
        prefetch={false}
        data-llm-text={`${pid}. ${problem.title}`}
        className="min-w-0 flex-1 truncate text-sm hover:underline"
      >
        {/* Keep the pid and title in one inline flow: margins or flex gaps
            are not painted by text-decoration, so splitting them would break
            the link underline between the id and the title. */}
        <span className="text-muted-foreground tabular-nums">{pid}. </span>
        {problem.title}
      </Link>
      <div className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs">
        {status && <StatusDot status={status} />}
        <DifficultyDot difficulty={problem.difficulty} />
        <MetaItem icon={Send} label={t('submissions')}>
          <span data-llm-text={String(problem.nSubmit)}>{problem.nSubmit}</span>
        </MetaItem>
        <MetaItem icon={CircleCheck} label={t('accepted')}>
          <span data-llm-text={String(problem.nAccept)}>{problem.nAccept}</span>
        </MetaItem>
      </div>
    </div>
  );
}

export default function RecentProblems({ problems, psdict }: Props) {
  const t = useTranslations('homepage');
  if (!problems.length) return null;

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="size-5" />
          <span data-llm-text={t('recentProblems')}>{t('recentProblems')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {problems.map((problem) => {
            // The status dict only holds problems this user has touched.
            const status: ProblemStatusDoc | undefined = psdict[problem.docId];

            return (
              <ProblemRow
                key={problem.docId}
                problem={problem}
                status={status}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
