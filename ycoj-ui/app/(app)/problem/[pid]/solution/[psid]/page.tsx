import ProblemTitle from '@/features/problem/detail/problem-title';
import { getProblemSolution } from '@/features/problem/solution/get-problem-solution';
import ScrollToTarget from '@/features/problem/solution/scroll-to-target';
import SolutionContent from '@/features/problem/solution/solution-content';
import SolutionRight from '@/features/problem/solution/solution-right';
import { Errored } from '@/shared/components/errored';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = {
  pid: string;
  psid: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pid, psid } = await params;
  const data = await getProblemSolution(pid, psid);
  const t = await getTranslations('metadata');
  if ('error' in data) return { title: t('solutions') };
  return {
    title: `${data.pdoc.title} - ${t('solutions')}`,
  };
}

/**
 * Read-only permalink for one solution.
 *
 * The backend has a dedicated mode for this: `GET /p/:pid/solution?sid=…`
 * returns only the requested solution (`ProblemSolutionHandler.get` slices
 * `psdocs` to `[solution.get(domainId, sid)]`). The list handler is reused
 * rather than a bespoke route so permissions, review grouping, votes and
 * replies stay identical, and the entry is highlighted in place.
 */
export default async function ProblemSolutionDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { pid, psid } = await params;
  const data = await getProblemSolution(pid, psid);
  if ('error' in data) {
    const t = await getTranslations('metadata');
    return <Errored title={t('solutions')} error={data.error} />;
  }

  return (
    <div className="space-y-6">
      <ProblemTitle problem={data.pdoc} />
      <ScrollToTarget targetId={`solution-${psid}`} />
      <TwoColumnLayout
        ratio="8-2"
        left={<SolutionContent data={data} highlightedId={psid} />}
        right={
          <SolutionRight problem={data.pdoc} solutionCount={data.pscount} />
        }
      />
    </div>
  );
}
