import type { ProblemDetailMode } from '@/api/server/method/problems/detail';
import ContestEndedNotice from '@/features/problem/detail/contest-ended-notice';
import ProblemSidebar from '@/features/problem/sidebar';
import messages from '@/messages/en';
import type {
  ContestListProjectionProblem,
  PublicProjectionProblem,
} from '@/shared/types/problem';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

const problem = {
  _id: 'p'.repeat(24),
  domainId: 'system',
  docType: 10,
  docId: 1,
  pid: 'P1000',
  owner: 1,
  title: 'A + B',
  nSubmit: 3,
  nAccept: 1,
  tag: [],
} as unknown as PublicProjectionProblem & ContestListProjectionProblem;

function renderNotice(mode: ProblemDetailMode | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContestEndedNotice mode={mode} />
    </NextIntlClientProvider>
  );
}

function renderSidebar(mode: ProblemDetailMode | undefined) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemSidebar
        allowSubmit
        problem={problem}
        tid="contest-1"
        mode={mode}
      />
    </NextIntlClientProvider>
  );
}

describe('contest ended notice', () => {
  it('explains that the problem cannot be submitted in an ended contest', () => {
    renderNotice('view');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(messages.problem.contestEndedTitle);
    expect(alert).toHaveTextContent(messages.problem.contestEndedView);
  });

  it('explains that new submissions count as corrections', () => {
    renderNotice('correction');
    expect(screen.getByRole('alert')).toHaveTextContent(
      messages.problem.contestEndedCorrection
    );
  });

  it('stays hidden while the contest is running or outside contest mode', () => {
    const { unmount } = renderNotice('contest');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    unmount();
    renderNotice('normal');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('problem sidebar in an ended contest', () => {
  it('offers the problem set instead of the contest submit entry', () => {
    renderSidebar('view');
    const openInProblemSet = screen.getByRole('link', {
      name: messages.problem.openInProblemSet,
    });
    // The contest context is dropped so the problem opens in normal mode.
    expect(openInProblemSet).toHaveAttribute('href', '/problem/P1000');
    expect(
      screen.queryByRole('link', { name: messages.problem.submit })
    ).not.toBeInTheDocument();
  });

  it('keeps the contest submit entry while the contest is running', () => {
    renderSidebar('contest');
    const submit = screen.getByRole('link', { name: messages.problem.submit });
    expect(submit).toHaveAttribute(
      'href',
      '/problem/P1000/submit?tid=contest-1'
    );
  });
});
