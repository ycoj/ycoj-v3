import '@/app/globals.css';
import ScoreboardTable from '@/features/contest/scoreboard/scoreboard-table';
import ContestRating from '@/features/user/profile/components/contest-rating';
import messages from '@/messages/en';
import type { UserContestRating } from '@/shared/types/rating';
import { act, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

const rating: UserContestRating = {
  rating: 1652,
  peak: 1670,
  contests: 4,
  provisional: true,
  history: [
    {
      uid: 1,
      rank: 2,
      before: 1670,
      after: 1652,
      delta: -18,
      provisional: true,
      tid: 'one',
      title: 'Weekly practice',
      endAt: '2026-10-20T10:00:00Z',
    },
    {
      uid: 1,
      rank: 1,
      before: 1600,
      after: 1670,
      delta: 70,
      provisional: true,
      tid: 'two',
      title: 'Autumn contest',
      endAt: '2026-10-13T10:00:00Z',
    },
  ],
};

function profile(value?: UserContestRating) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <main className="mx-auto max-w-4xl p-4">
        <ContestRating rating={value} />
      </main>
    </NextIntlClientProvider>
  );
}

describe('contest rating results', () => {
  it('shows an unrated state without inventing a score', () => {
    profile();
    expect(screen.getByText(/No rating yet/)).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  for (const width of [1280, 390]) {
    it(`shows current, peak, provisional status and signed history at ${width}px`, async () => {
      await page.viewport(width, 900);
      profile(rating);
      expect(
        screen.getByRole('heading', { name: 'Contest rating' })
      ).toBeVisible();
      expect(screen.getByText('Peak rating')).toBeVisible();
      expect(screen.getAllByText('1,670')[0]).toBeVisible();
      expect(screen.getByText('Provisional')).toBeVisible();
      await page.screenshot({
        path: `../../../test-results/rating-profile-${width}.png`,
      });
      const table = within(screen.getByRole('table'));
      expect(
        table.getByRole('link', { name: 'Weekly practice' })
      ).toHaveAttribute('href', '/contest/one/scoreboard');
      expect(table.getByLabelText('Rating change -18')).toBeVisible();
      expect(table.getByLabelText('Rating change +70')).toBeVisible();
      expect(
        screen.getByRole('group', { name: 'Rating history' })
      ).toBeVisible();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      expect(
        screen.queryByRole('button', { name: /Show all/ })
      ).not.toBeInTheDocument();
    });
  }

  it('shows the latest three contests and expands the entire history on demand', async () => {
    const history = Array.from({ length: 35 }, (_, index) => ({
      ...rating.history[0],
      tid: `contest-${index}`,
      title: `Practice ${35 - index}`,
      endAt: new Date(Date.UTC(2026, 8, 35 - index)).toISOString(),
    }));
    profile({ ...rating, contests: 35, history });
    const table = within(screen.getByRole('table'));
    expect(table.getAllByRole('row')).toHaveLength(4);
    expect(table.getByRole('link', { name: 'Practice 35' })).toBeVisible();
    expect(
      table.queryByRole('link', { name: 'Practice 32' })
    ).not.toBeInTheDocument();
    for (const width of [390, 1280]) {
      await act(async () => {
        await page.viewport(width, 900);
      });
      await page.screenshot({
        path: `../../../test-results/rating-recent-${width}.png`,
      });
    }
    await page.getByRole('button', { name: 'Show all 35 contests' }).click();
    expect(table.getAllByRole('row')).toHaveLength(36);
    expect(table.getByRole('link', { name: 'Practice 1' })).toBeVisible();
    await page.getByRole('button', { name: 'Show latest 3 contests' }).click();
    expect(table.getAllByRole('row')).toHaveLength(4);
  });

  it('lets keyboard users inspect a contest on the chart and open its scoreboard', async () => {
    profile(rating);
    const point = screen.getByRole('link', {
      name: 'Autumn contest: Rating 1,670, change +70',
    });
    await act(async () => point.focus());
    await expect
      .element(
        page.getByRole('link', { name: 'Autumn contest', exact: true }).first()
      )
      .toBeVisible();
    const details = screen.getByRole('figure');
    expect(within(details).getByLabelText('Rating change +70')).toBeVisible();
    expect(point).toHaveAttribute('href', '/contest/two/scoreboard');
  });

  it('shows a single contest as a change from its starting rating', () => {
    profile({ ...rating, contests: 1, history: [rating.history[0]] });
    expect(screen.getByText('Starting at 1,670')).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: 'Weekly practice: Rating 1,652, change -18',
      })
    ).toBeVisible();
  });

  it('associates rating changes with the correct participant and leaves unranked users unrated', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ScoreboardTable
          rows={[
            [
              { type: 'rank', value: '#' },
              { type: 'user', value: 'User' },
            ],
            [
              { type: 'rank', value: 1 },
              { type: 'user', value: 'alice', raw: 1 },
            ],
            [
              { type: 'rank', value: 0 },
              { type: 'user', value: 'bob', raw: 2 },
            ],
          ]}
          udict={{
            1: { _id: 1, uname: 'alice', mail: '', avatar: '' },
            2: { _id: 2, uname: 'bob', mail: '', avatar: '' },
          }}
          pdict={{}}
          tid="contest"
          pageType="contest"
          rating={{ status: 'settled', changes: [rating.history[0]] }}
        />
      </NextIntlClientProvider>
    );
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByLabelText('Rating change -18')).toBeVisible();
    expect(within(rows[2]).getByText('—')).toBeVisible();
    expect(
      within(rows[2]).queryByLabelText(/Rating change/)
    ).not.toBeInTheDocument();
  });
});
