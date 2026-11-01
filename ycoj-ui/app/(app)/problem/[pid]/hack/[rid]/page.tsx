import ServerApis from '@/api/server/method';
import { getProblemDetail } from '@/features/problem/detail/get-problem-detail';
import ProblemHackContent from '@/features/problem/hack/problem-hack-content';
import { getUser } from '@/features/user/lib/get-user';
import { hasPerm, PERM } from '@/features/user/lib/priv';
import { Errored } from '@/shared/components/errored';
import type { HydroError } from '@/shared/types/error';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

type Params = { pid: string; rid: string };
type SearchParams = { tid?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { pid } = await params;
  const t = await getTranslations('metadata');
  const detail = await getProblemDetail(pid);
  if ('error' in detail || !detail.pdoc) return { title: t('problemDetail') };
  return { title: `${detail.pdoc.title} - ${t('problemDetail')}` };
}

export default async function ProblemHackPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { pid, rid } = await params;
  const { tid } = await searchParamsPromise;
  const t = await getTranslations('problem');

  const [problem, user] = await Promise.all([
    getProblemDetail(pid, tid),
    getUser(),
  ]);
  if ('error' in problem) {
    return <Errored title={t('unavailable')} error={problem.error} />;
  }
  if (!problem.pdoc) {
    return <Errored title={t('unavailable')} error={t('unavailable')} />;
  }

  // Guests cannot hack; the submit route itself requires the permission.
  if (!user?._id) {
    const next = `/problem/${pid}/hack/${rid}${tid ? `?tid=${tid}` : ''}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  if (!hasPerm(user, PERM.PERM_SUBMIT_PROBLEM)) {
    return <Errored title={t('unavailable')} error={t('unavailable')} />;
  }
  if (!problem.pdoc.config?.hackable) {
    return <Errored title={t('unavailable')} error={t('notHackable')} />;
  }

  // The target record must belong to this problem; a mismatched or missing
  // record is reported before the form is rendered.
  let target:
    Awaited<ReturnType<typeof ServerApis.Record.getRecordDetail>> | undefined;
  let targetError: HydroError | undefined;
  try {
    target = await ServerApis.Record.getRecordDetail(rid);
    if (target.rdoc.pid !== problem.pdoc.docId) {
      target = undefined;
      targetError = {
        name: 'RecordNotFoundError',
        message: t('unavailable'),
      };
    }
  } catch (caught) {
    targetError = {
      name: 'RecordNotFoundError',
      message: caught instanceof Error ? caught.message : t('unavailable'),
    };
  }

  return (
    <div className="space-y-6">
      <ProblemHackContent
        pid={problem.pdoc.pid ?? problem.pdoc.docId}
        rid={rid}
        tid={tid}
        problem={problem}
        target={target}
        targetError={targetError}
      />
    </div>
  );
}
