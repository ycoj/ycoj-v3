import type { RecordDetailResponse } from '@/api/server/method/record/detail';
import type { ProblemDetailData } from '@/features/problem/detail/get-problem-detail';
import ProblemTitle from '@/features/problem/detail/problem-title';
import ProblemHackForm from '@/features/problem/hack/problem-hack-form';
import ProblemSidebar from '@/features/problem/sidebar';
import { Errored } from '@/shared/components/errored';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { HydroError } from '@/shared/types/error';
import { getTranslations } from 'next-intl/server';

type Props = {
  pid: string | number;
  rid: string;
  tid?: string;
  problem: ProblemDetailData;
  target?: RecordDetailResponse;
  targetError?: HydroError;
};

/**
 * Hack page body.
 *
 * The backend validates hackability, ownership and contest rules when the new
 * record is created. The page itself only needs the target submission to show
 * what is being challenged; a missing target is an error state without the
 * form.
 */
export default async function ProblemHackContent({
  pid,
  rid,
  tid,
  problem,
  target,
  targetError,
}: Props) {
  const t = await getTranslations('problem');
  const tHack = await getTranslations('problemOps.hack');

  if (targetError || !target) {
    return (
      <Errored
        title={t('unavailable')}
        error={targetError ?? t('unavailable')}
      />
    );
  }

  return (
    <div className="space-y-6">
      <ProblemTitle problem={problem.pdoc} contest={problem.tdoc} />
      <TwoColumnLayout
        ratio="8-2"
        left={
          <div className="space-y-6" data-llm-visible="true">
            <header className="space-y-1">
              <h2 className="text-xl text-primary">
                {tHack('title', { rid })}
              </h2>
              <p className="text-muted-foreground text-sm">
                {tHack('description', {
                  title: target.pdoc?.title ?? problem.pdoc.title,
                  user: target.udoc?.uname ?? '',
                })}
              </p>
            </header>
            <ProblemHackForm pid={pid} rid={rid} tid={tid} />
          </div>
        }
        right={
          <ProblemSidebar
            allowSubmit={false}
            showBackToProblem={true}
            solutionCount={problem.solutionCount}
            discussionCount={problem.discussionCount}
            problem={problem.pdoc}
            tid={tid}
            contest={problem.tdoc}
            contestStatus={problem.tsdoc}
            mode={problem.mode}
          />
        }
      />
    </div>
  );
}
