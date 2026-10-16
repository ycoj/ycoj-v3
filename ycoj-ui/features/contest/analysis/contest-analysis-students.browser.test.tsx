import '@/app/globals.css';
import ContestAnalysisStudents from './contest-analysis-students';
import messages from '@/messages/en';
import type {
  ContestAnalysisContestFact,
  ContestAnalysisStudentFact,
  ContestAnalysisStudentReport,
} from '@/shared/types/contest-analysis';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

const contests = [
  {
    tid: 'r1',
    title: 'Round 1',
    rule: 'oi',
    beginAt: '2026-09-01T00:00:00.000Z',
    endAt: '2026-09-01T04:00:00.000Z',
    durationMs: 14_400_000,
    registeredCount: 2,
    participantCount: 2,
    problems: [],
    difficultyGradient: [],
    tagOverlap: [],
    scoreStats: { count: 2, mean: 0, median: 0, max: 0, min: 0, buckets: [] },
  },
] satisfies ContestAnalysisContestFact[];

function fact(
  uid: number,
  uname: string,
  displayName: string
): ContestAnalysisStudentFact {
  return {
    uid,
    uname,
    displayName,
    contests: [],
    totals: {
      score: 0,
      maxScore: 100,
      contestCount: 1,
      attendedCount: 1,
      solvedCount: 0,
      problemCount: 1,
      averageScore: 0,
      medianRank: uid,
    },
    tags: [],
  };
}

function report(
  uid: number,
  level: ContestAnalysisStudentReport['level'],
  summary: string,
  focusTags: string[]
): ContestAnalysisStudentReport {
  return {
    uid,
    level,
    summary,
    strengths: [],
    weaknesses: [],
    recurringIssues: [],
    focusTags,
    contestComments: [{ tid: 'r1', comment: 'kept trying' }],
    actionPlan: [],
  };
}

const facts = [fact(1, 'alice', 'Alice'), fact(2, 'bob', 'Bob')];
const reports = [
  report(1, 'good', 'Alice kept a steady score.', ['sorting']),
  report(2, 'at_risk', 'Bob skipped the hard problems.', [
    'dynamic programming',
  ]),
];

function renderStudents() {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Shanghai"
    >
      <ContestAnalysisStudents
        reports={reports}
        facts={facts}
        contests={contests}
      />
    </NextIntlClientProvider>
  );
}

describe('contest analysis students section', () => {
  it('filters the individual reports by search text and level', async () => {
    const user = userEvent.setup();
    renderStudents();
    expect(screen.getByText('Alice')).toBeVisible();
    expect(screen.getByText('Bob')).toBeVisible();

    await user.type(screen.getByLabelText('Search student or tag'), 'dynamic');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeVisible();

    await user.clear(screen.getByLabelText('Search student or tag'));
    expect(screen.getByText('Alice')).toBeVisible();

    const atRisk = screen.getByRole('button', { name: /At risk/ });
    await user.click(atRisk);
    expect(atRisk).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeVisible();
  });

  it('shows the per-student evidence blocks', () => {
    renderStudents();
    expect(screen.getAllByText('Per-contest notes')).toHaveLength(2);
    expect(screen.getAllByText('Focus tags')).toHaveLength(2);
  });
});
