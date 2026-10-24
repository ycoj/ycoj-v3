import '@/app/globals.css';
import RankingLeaderboard from './ranking-leaderboard';
import RankingSortControl from './ranking-sort-control';
import type {
  RankingSort,
  RankingUser,
} from '@/api/server/method/ranking/list';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { page as browserPage } from 'vitest/browser';

function makeUser(overrides: Partial<RankingUser> = {}): RankingUser {
  return {
    _id: 2,
    uname: 'alice',
    mail: 'alice@example.com',
    avatar: '',
    rp: 123.6,
    rpInfo: { contest: 23.4, problem: 100.2 },
    nAccept: 7,
    bio: null,
    ...overrides,
  };
}

function renderLeaderboard(
  users: RankingUser[],
  sort: RankingSort = 'rp',
  page = 1,
  canViewRating = true
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <main className="mx-auto max-w-4xl p-4">
        <RankingSortControl sort={sort} canViewRating={canViewRating} />
        <RankingLeaderboard
          udocs={users}
          page={page}
          pageSize={20}
          sort={sort}
        />
      </main>
    </NextIntlClientProvider>
  );
}

describe('RankingLeaderboard', () => {
  for (const width of [390, 1280]) {
    it(`keeps the Rating leaderboard readable at ${width}px`, async () => {
      await browserPage.viewport(width, 900);
      renderLeaderboard(
        [
          makeUser({
            contestRating: {
              rating: 1652,
              peak: 1670,
              contests: 4,
              provisional: true,
            },
          }),
        ],
        'rating'
      );
      expect(screen.getByText('1,652')).toBeVisible();
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      await browserPage.screenshot({
        path: `../../test-results/rating-ranking-${width}.png`,
      });
    });
  }
  it('switches ranking criteria with a fresh first-page URL', () => {
    renderLeaderboard([makeUser()]);
    expect(screen.getByRole('link', { name: 'Rating' })).toHaveAttribute(
      'href',
      '/ranking?sort=rating'
    );
    expect(screen.getByRole('link', { name: 'RP' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('shows contest rating and provisional status with the server-provided page order', () => {
    renderLeaderboard(
      [
        makeUser({
          contestRating: {
            rating: 1652,
            peak: 1670,
            contests: 4,
            provisional: true,
          },
        }),
      ],
      'rating',
      2
    );
    expect(screen.getByText('1,652')).toBeVisible();
    expect(screen.getByText('Provisional')).toBeVisible();
    expect(screen.getByText('21')).toBeVisible();
    expect(screen.queryByText('124')).not.toBeInTheDocument();
    expect(screen.queryByText('Problems')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rating' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('explains an empty rating leaderboard', () => {
    renderLeaderboard([], 'rating');
    expect(screen.getByText('No rated participants yet')).toBeVisible();
  });

  it('hides the Rating choice from viewers without scoreboard access', () => {
    renderLeaderboard([makeUser()], 'rp', 1, false);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.queryByText('Rating')).not.toBeInTheDocument();
  });

  it('renders RP and accepted problem counts as LLM-visible metrics', () => {
    const userWithoutAccept = makeUser({ _id: 3, uname: 'bob', rp: 80 });
    delete (userWithoutAccept as Partial<RankingUser>).nAccept;

    renderLeaderboard([makeUser(), userWithoutAccept]);

    expect(screen.getByText('Accepted')).toBeInTheDocument();
    expect(screen.getByText('124').closest('td')).toHaveAttribute(
      'data-llm-text',
      '123.6'
    );
    expect(screen.getByText('7').closest('td')).toHaveAttribute(
      'data-llm-text',
      '7'
    );
    expect(screen.getByText('0').closest('td')).toHaveAttribute(
      'data-llm-text',
      '0'
    );
  });
});
