import RecentProblems from './recent-problems';
import messages from '@/messages/en';
import { STATUS } from '@/shared/configs/status';
import type {
  ListProjectionProblem,
  ProblemStatus,
  ProblemStatusDict,
} from '@/shared/types/problem';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

function makeProblem(
  overrides: Partial<ListProjectionProblem> = {}
): ListProjectionProblem {
  return {
    _id: 'p'.repeat(24),
    domainId: 'system',
    docType: 10,
    docId: 1000,
    pid: 'P1000',
    owner: 1,
    title: 'A + B',
    nSubmit: 10,
    nAccept: 5,
    difficulty: 3,
    tag: [],
    hidden: false,
    ...overrides,
  };
}

function renderCard(
  problems: ListProjectionProblem[],
  psdict: ProblemStatusDict = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RecentProblems problems={problems} psdict={psdict} />
    </NextIntlClientProvider>
  );
}

describe('RecentProblems', () => {
  it('links every problem by its displayed id and title', () => {
    renderCard([
      makeProblem(),
      makeProblem({ docId: 1001, pid: '', title: 'Sorting Again' }),
    ]);

    const [first, second] = screen.getAllByRole('link');
    expect(first).toHaveAttribute('href', '/problem/P1000');
    // The pid and title stay separated by a space rather than running together.
    expect(first).toHaveTextContent('P1000. A + B');
    // A problem without a custom pid falls back to the P-prefixed doc id.
    expect(second).toHaveAttribute('href', '/problem/1001');
    expect(second).toHaveTextContent('P1001. Sorting Again');
  });

  it('shows submission and acceptance counts for each problem', () => {
    renderCard([makeProblem({ nSubmit: 128, nAccept: 96 })]);

    expect(screen.getByTitle('Submissions')).toHaveTextContent('128');
    expect(screen.getByTitle('Accepted')).toHaveTextContent('96');
  });

  it('shows the difficulty of each problem', () => {
    renderCard([
      makeProblem({ difficulty: 1 }),
      makeProblem({ docId: 1002, pid: 'P1002', difficulty: 5 }),
    ]);

    expect(screen.getByRole('img', { name: 'Beginner' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Advanced' })).toBeVisible();
  });

  it('shows the viewer result only for problems already attempted', () => {
    const attempted: ProblemStatus = {
      _id: 'a'.repeat(24),
      docId: 1000,
      docType: 10,
      domainId: 'system',
      status: STATUS.STATUS_ACCEPTED,
    };
    renderCard([makeProblem(), makeProblem({ docId: 1001, pid: 'P1001' })], {
      1000: attempted,
    });

    // One status dot for the attempted problem, none for the untouched one.
    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('img', { name: 'Accepted' })).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it('hides the card when there are no problems', () => {
    const { container } = renderCard([]);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Recent problems')).not.toBeInTheDocument();
  });
});
