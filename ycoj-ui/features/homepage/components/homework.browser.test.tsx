import HomeworkSection from './homework';
import messages from '@/messages/en';
import type { ContestStatus } from '@/shared/types/contest';
import type { Homework } from '@/shared/types/homework';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

function makeHomework(overrides: Partial<Homework> = {}): Homework {
  return {
    _id: 'h'.repeat(24),
    docId: 'h'.repeat(24),
    docType: 30,
    domainId: 'system',
    owner: 1,
    beginAt: new Date('2026-01-01T00:00:00Z'),
    endAt: new Date('2026-01-08T00:00:00Z'),
    penaltySince: new Date('2026-01-05T00:00:00Z'),
    attend: 12,
    title: 'Week 1 assignment',
    content: '',
    rule: 'homework',
    pids: [],
    duration: 168,
    ...overrides,
  };
}

function renderSection(
  homeworks: Homework[],
  statusDict: Record<string, ContestStatus> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <HomeworkSection homeworks={homeworks} statusDict={statusDict} />
    </NextIntlClientProvider>
  );
}

describe('homepage homework section', () => {
  it('links each assignment to its detail page', () => {
    renderSection([makeHomework()]);

    expect(
      screen.getByRole('link', { name: 'Week 1 assignment' })
    ).toHaveAttribute('href', `/homework/${'h'.repeat(24)}`);
  });

  it('shows participation and a joined badge only when claimed', () => {
    renderSection([makeHomework()], {
      ['h'.repeat(24)]: { attend: 1 },
    });

    expect(screen.getByTitle('Participants')).toHaveTextContent('12');
    expect(screen.getByText('Joined')).toBeVisible();
  });

  it('hides itself when no homework is available', () => {
    const { container } = renderSection([]);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText('Homework')).not.toBeInTheDocument();
  });
});
