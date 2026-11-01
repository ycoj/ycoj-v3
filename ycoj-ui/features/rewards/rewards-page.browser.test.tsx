import '@/app/globals.css';
import './rewards.css';
import RewardsPage from './rewards-page';
import messages from '@/messages/en';
import type { RewardsData } from '@/shared/types/rewards';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  get: vi.fn(),
  checkin: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/api/client/method/rewards', () => ({
  updateRewards: mocks.update,
  getRewards: mocks.get,
}));
vi.mock('@/api/client/method', () => ({
  default: { Checkin: { checkin: mocks.checkin } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

function fixture(): RewardsData {
  return {
    date: '2026-11-02',
    week: '2026-11-02',
    timezone: 'Asia/Shanghai',
    wallet: {
      balance: 100,
      earned: 100,
      spent: 0,
      owned: [],
      equipped: {},
      ledger: [
        {
          id: 'welcome',
          reason: 'welcome',
          amount: 100,
          at: '2026-11-02T04:00:00Z',
        },
      ],
    },
    tasks: [
      {
        id: 'checkin',
        period: 'daily',
        target: 1,
        coins: 5,
        key: '2026-11-02:checkin',
        progress: 0,
        claimed: false,
      },
      {
        id: 'first-solve',
        period: 'daily',
        target: 1,
        coins: 15,
        key: '2026-11-02:first-solve',
        progress: 1,
        claimed: false,
      },
      {
        id: 'three-solves',
        period: 'daily',
        target: 3,
        coins: 20,
        key: '2026-11-02:three-solves',
        progress: 1,
        claimed: false,
      },
      {
        id: 'comeback',
        period: 'daily',
        target: 1,
        coins: 10,
        key: '2026-11-02:comeback',
        progress: 0,
        claimed: false,
      },
      {
        id: 'practice-days',
        period: 'weekly',
        target: 3,
        coins: 40,
        key: '2026-11-02:practice-days',
        progress: 1,
        claimed: false,
      },
      {
        id: 'eight-solves',
        period: 'weekly',
        target: 8,
        coins: 60,
        key: '2026-11-02:eight-solves',
        progress: 1,
        claimed: false,
      },
    ],
    catalog: [
      { id: 'frame-sprout', slot: 'frame', price: 60 },
      { id: 'frame-starlight', slot: 'frame', price: 180 },
      { id: 'title-explorer', slot: 'title', price: 80 },
      { id: 'background-sky', slot: 'background', price: 120 },
      { id: 'accent-forest', slot: 'accent', price: 160 },
    ],
  };
}

function renderPage(data = fixture(), uname = 'Alice') {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Shanghai"
    >
      <RewardsPage
        initialData={data}
        user={{ _id: 2, uname, mail: '', avatar: '' }}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('learning rewards page', () => {
  it('claims a completed task once, blocks repeat clicks while pending, and displays the new balance', async () => {
    const next = fixture();
    next.wallet.balance = 115;
    next.tasks[1].claimed = true;
    let finish!: (value: RewardsData) => void;
    mocks.update.mockReturnValue({
      send: () =>
        new Promise<RewardsData>((resolve) => {
          finish = resolve;
        }),
    });
    renderPage();
    const claim = screen.getByRole('button', {
      name: 'Claim coins for One step forward',
    });
    expect(
      screen.getByRole('button', { name: 'Claim coins for Three little stars' })
    ).toBeDisabled();
    fireEvent.click(claim);
    expect(claim).toBeDisabled();
    fireEvent.click(claim);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => finish(next));
    expect(
      await screen.findByRole('button', {
        name: 'Coins claimed for One step forward',
      })
    ).toBeDisabled();
    expect(screen.getByText('115')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Coins received');
  });

  it('checks in before exposing a claim and never awards client-side coins', async () => {
    const next = fixture();
    next.tasks[0].progress = 1;
    mocks.checkin.mockReturnValue({
      send: async () => ({ created: true, record: {} }),
    });
    mocks.get.mockReturnValue({ send: async () => next });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Check in today' }));
    expect(
      await screen.findByRole('button', {
        name: 'Claim coins for Here again today',
      })
    ).toBeEnabled();
    expect(screen.getByText('100')).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('previews, redeems, equips, and removes permanent items without losing ownership', async () => {
    let next = fixture();
    mocks.update.mockImplementation((action) => ({
      send: async () => {
        next = structuredClone(next);
        if (action.action === 'buy') {
          next.wallet.balance = 40;
          next.wallet.owned = ['frame-sprout'];
        } else if (action.action === 'equip')
          next.wallet.equipped.frame = action.id;
        else delete next.wallet.equipped.frame;
        return next;
      },
    }));
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Confirm redemption · 60 coins',
      })
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Equip' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Appearance equipped'
      )
    );
    expect(mocks.update).toHaveBeenLastCalledWith({
      action: 'equip',
      id: 'frame-sprout',
    });
    expect(mocks.refresh).toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove Avatar frame' })
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Default appearance restored'
      )
    );
    expect(screen.getByRole('button', { name: 'Equip' })).toBeVisible();
    expect(screen.getByText('40')).toBeVisible();
  });

  it('disables unaffordable items and shows server errors without inventing a balance change', async () => {
    mocks.update.mockReturnValue({
      send: async () => ({
        error: { name: 'RewardError', message: 'insufficient-coins' },
      }),
    });
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview Starlight frame' })
    );
    expect(
      screen.getByRole('button', { name: 'Confirm redemption · 180 coins' })
    ).toBeDisabled();
    expect(
      screen.getByText('Save 80 more coins by completing learning tasks.')
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Sprout frame' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm redemption · 60 coins' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You need more coins'
    );
    expect(screen.getByText('100')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Equip' })
    ).not.toBeInTheDocument();
  });

  it.each([375, 1280])(
    'keeps tasks, previews, and history readable at %ipx',
    async (width) => {
      await page.viewport(width, 1100);
      try {
        renderPage(fixture(), 'A-student-with-a-very-long-display-name');
        expect(
          screen.getByRole('heading', { name: 'Growth & coins' })
        ).toBeVisible();
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        await userEvent.click(
          screen.getByRole('tab', { name: 'Appearance shop' })
        );
        expect(
          await screen.findByRole('complementary', {
            name: 'Appearance preview',
          })
        ).toBeVisible();
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        fireEvent.click(
          screen.getByRole('checkbox', { name: 'Owned items only' })
        );
        expect(
          screen.getByText(
            'Your inventory is empty. Clear the filter to find your first reward.'
          )
        ).toBeVisible();
        await userEvent.click(
          screen.getByRole('tab', { name: 'Coin history' })
        );
        expect(await screen.findByText('Welcome gift')).toBeVisible();
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      } finally {
        await page.viewport(1280, 900);
      }
    }
  );
});
