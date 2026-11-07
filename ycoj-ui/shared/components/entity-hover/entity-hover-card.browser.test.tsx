import messages from '@/messages/en';
import EntityHoverCard from '@/shared/components/entity-hover/entity-hover-card';
import EntityHoverLink from '@/shared/components/entity-hover/entity-hover-link';
import { clearEntityPreviewCache } from '@/shared/components/entity-hover/load-entity-preview';
import { Button } from '@/shared/components/ui/button';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('@/api/client/method/entity-preview', () => ({
  getEntityPreview: () => ({ send: mocks.send }),
}));

const problem = {
  kind: 'problem',
  id: 'P1000',
  pid: 'P1000',
  title: 'A + B Problem',
  difficulty: 3,
  tags: ['math', 'implementation'],
  nAccept: 12,
  nSubmit: 40,
  hidden: false,
};

const contest = {
  kind: 'contest',
  id: '665f00000000000000000001',
  title: 'Weekly Round',
  rule: 'oi',
  status: 'pending',
  beginAt: '2026-09-01T02:00:00.000Z',
  endAt: '2026-09-01T06:00:00.000Z',
  attend: 24,
  problemCount: 6,
  rated: true,
};

const homework = {
  kind: 'homework',
  id: '665f00000000000000000002',
  title: 'Week 1',
  status: 'running',
  deadline: '2026-09-08T15:59:00.000Z',
  attend: 18,
  problemCount: 5,
};

const training = {
  kind: 'training',
  id: '665f00000000000000000003',
  title: 'Dynamic Programming',
  excerpt: 'Knapsack and longest increasing subsequences.',
  sectionCount: 4,
  problemCount: 12,
  attend: 30,
  enrolled: true,
  progress: 42,
};

function renderCard(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      {ui}
    </NextIntlClientProvider>
  );
}

async function hoverLink(name: string) {
  await userEvent.hover(screen.getByRole('link', { name }));
}

describe('EntityHoverCard', () => {
  beforeEach(() => {
    clearEntityPreviewCache();
    mocks.send.mockReset();
  });

  it('shows a problem preview after the pointer rests on the link', async () => {
    mocks.send.mockResolvedValue(problem);
    renderCard(
      <EntityHoverCard kind="problem" id="P1000" openDelay={0} closeDelay={0}>
        <Link href="/problem/P1000">A + B Problem</Link>
      </EntityHoverCard>
    );

    await hoverLink('A + B Problem');

    expect(await screen.findByText('P1000')).toBeVisible();
    expect(screen.getByText('Basic')).toBeVisible();
    expect(screen.getByText('math · implementation')).toBeVisible();
    expect(screen.getByText('12 accepted · 40 submitted')).toBeVisible();
    expect(screen.getAllByText('A + B Problem')).toHaveLength(2);
  });

  it('shows contest, homework, and training summaries', async () => {
    mocks.send.mockImplementation(async () => {
      const calls = mocks.send.mock.calls.length;
      return [contest, homework, training][calls - 1];
    });
    renderCard(
      <div>
        <EntityHoverLink
          href="/contest/665f00000000000000000001"
          openDelay={0}
          closeDelay={0}
        >
          Weekly Round
        </EntityHoverLink>
        <EntityHoverLink
          href="/homework/665f00000000000000000002"
          openDelay={0}
          closeDelay={0}
        >
          Week 1
        </EntityHoverLink>
        <EntityHoverLink
          href="/training/665f00000000000000000003"
          openDelay={0}
          closeDelay={0}
        >
          Dynamic Programming
        </EntityHoverLink>
      </div>
    );

    await hoverLink('Weekly Round');
    expect(await screen.findByText('Upcoming')).toBeVisible();
    expect(screen.getByText('OI')).toBeVisible();
    expect(screen.getByText(/24 participants · 6 problems/)).toBeVisible();
    expect(screen.getByText(/Rated/)).toBeVisible();

    await userEvent.unhover(screen.getByRole('link', { name: 'Weekly Round' }));
    await hoverLink('Week 1');
    expect(await screen.findByText(/^Due /)).toBeVisible();
    expect(screen.getByText('Running')).toBeVisible();
    expect(screen.getByText(/18 participants · 5 problems/)).toBeVisible();

    await userEvent.unhover(screen.getByRole('link', { name: 'Week 1' }));
    await hoverLink('Dynamic Programming');
    expect(
      await screen.findByText('Knapsack and longest increasing subsequences.')
    ).toBeVisible();
    expect(screen.getByText('4 sections · 12 problems')).toBeVisible();
    expect(screen.getByText(/42% complete/)).toBeVisible();
  });

  it('shows a user name and a short stat line', async () => {
    mocks.send.mockResolvedValue({
      kind: 'user',
      id: '12',
      uname: 'alice',
      avatar: '',
      nAccept: 42,
      rating: 1840,
      rank: 7,
      ccfLevel: 6,
      priv: 0,
      equipment: { frame: 'frame-starlight', background: 'background-sky' },
    });
    renderCard(
      <EntityHoverLink href="/user/12" openDelay={0} closeDelay={0}>
        alice
      </EntityHoverLink>
    );

    await hoverLink('alice');
    expect(await screen.findByText(/42 solved · Rating 1840/)).toBeVisible();
    expect(screen.getByAltText('CCF 6')).toBeVisible();
    expect(screen.queryByText('Alice Chen')).not.toBeInTheDocument();
    expect(screen.queryByText('Root')).not.toBeInTheDocument();
    expect(screen.queryByText('Algorithm explorer')).not.toBeInTheDocument();
  });

  it('explains a failed preview', async () => {
    mocks.send.mockRejectedValue(new Error('offline'));
    renderCard(
      <EntityHoverLink href="/problem/P1000" openDelay={0} closeDelay={0}>
        A + B
      </EntityHoverLink>
    );

    await hoverLink('A + B');
    expect(await screen.findByText("Couldn't load the preview.")).toBeVisible();
  });

  it('keeps the link in place and explains a denied preview', async () => {
    mocks.send.mockResolvedValue({ error: { name: 'PermissionError' } });
    renderCard(
      <Button asChild variant="link">
        <EntityHoverLink href="/problem/P1000" openDelay={0} closeDelay={0}>
          Hidden problem
        </EntityHoverLink>
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Hidden problem' });
    expect(link).toHaveAttribute('href', '/problem/P1000');
    await userEvent.hover(link);
    expect(
      await screen.findByText("You don't have access to this.")
    ).toBeVisible();
  });

  it('shows a loading state, then reopens from cache without loading again', async () => {
    let resolvePreview: (value: typeof problem) => void = () => undefined;
    mocks.send.mockReturnValue(
      new Promise((resolve) => {
        resolvePreview = resolve;
      })
    );
    renderCard(
      <EntityHoverCard kind="problem" id="P1000" openDelay={0} closeDelay={0}>
        <Link href="/problem/P1000">A + B Problem</Link>
      </EntityHoverCard>
    );
    const link = screen.getByRole('link', { name: 'A + B Problem' });
    await userEvent.hover(link);
    expect(
      await screen.findByRole('status', { name: 'Loading preview' })
    ).toBeVisible();
    resolvePreview(problem);
    expect(await screen.findByText('12 accepted · 40 submitted')).toBeVisible();

    await userEvent.unhover(link);
    await waitFor(() => {
      expect(screen.queryByText('12 accepted · 40 submitted')).toBeNull();
    });
    await userEvent.hover(link);
    expect(
      screen.queryByRole('status', { name: 'Loading preview' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('12 accepted · 40 submitted')).toBeVisible();
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
