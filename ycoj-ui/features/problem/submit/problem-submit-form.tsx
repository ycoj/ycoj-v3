import ProblemSubmitFormClient from './problem-submit-form-client';
import ServerApis from '@/api/server/method';
import type { ProblemDetailMode } from '@/api/server/method/problems/detail';
import { getContestStatus } from '@/features/contest/detail/contest-utils';
import { getContestEndedVariant } from '@/features/problem/detail/contest-ended-mode';
import type { Contest } from '@/shared/types/contest';
import type { Homework } from '@/shared/types/homework';
import { PublicProjectionProblem } from '@/shared/types/problem';
import dayjs from 'dayjs';

type Props = {
  problem: PublicProjectionProblem;
  tid?: string;
  contest?: Contest | Homework;
  mode?: ProblemDetailMode;
};

export default async function ProblemSubmitForm({
  problem,
  tid,
  contest,
  mode,
}: Props) {
  const languagesRes = await ServerApis.UI.getAvailableLanguages(problem.docId);
  const submitId = problem.pid || problem.docId.toString();

  // 判断比赛是否已结束
  const contestOver = contest
    ? getContestStatus(contest, dayjs()) === 'ended'
    : false;
  // The backend mode is authoritative; fall back to the clock so a missing
  // mode still blocks the form and still explains why.
  const contestEndedMode: ProblemDetailMode | undefined =
    getContestEndedVariant(mode) ?? (contestOver ? 'view' : undefined);

  return (
    <ProblemSubmitFormClient
      pid={submitId}
      tid={tid}
      languages={languagesRes.languages}
      contestEndedMode={contestEndedMode}
    />
  );
}
