import '@/app/globals.css';
import './rewards.css';
import RewardThemeSync from './reward-theme-sync';
import RewardsPage from './rewards-page';
import UserAvatar from '@/features/user/user-avatar';
import messages from '@/messages/en';
import zhMessages from '@/messages/zh';
import { Button } from '@/shared/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/shared/components/ui/sidebar';
import type { RewardsData } from '@/shared/types/rewards';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Coins, Code2, Home, Dumbbell } from 'lucide-react';
import { NextIntlClientProvider } from 'next-intl';
import { createPortal } from 'react-dom';
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
vi.mock('@/features/user/lib/avatar-url', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/user/lib/avatar-url')>();
  const robot =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#e7eff5"/><path d="M50 25V16" stroke="#7a9dab" stroke-width="4"/><circle cx="50" cy="13" r="5" fill="#8dcaa6"/><rect x="18" y="29" width="64" height="48" rx="19" fill="#fff"/><rect x="27" y="40" width="46" height="25" rx="11" fill="#385b73"/><circle cx="40" cy="52" r="4" fill="#a5e6e1"/><circle cx="60" cy="52" r="4" fill="#a5e6e1"/><path d="M44 70Q50 74 56 70" fill="none" stroke="#9fbdc8" stroke-width="3" stroke-linecap="round"/><path d="M27 100V90Q50 73 73 90V100" fill="#8dcaa6"/></svg>';
  return {
    default: (avatar: string) =>
      avatar === 'preview'
        ? `data:image/svg+xml,${encodeURIComponent(robot)}`
        : actual.default(avatar),
  };
});

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
          id: 'adjust-1',
          reason: 'admin-adjust',
          amount: 20,
          at: '2026-11-02T05:00:00Z',
          by: 3,
          byName: 'coach',
          note: 'Weekly prize',
        },
        {
          id: 'retire:frame-sprout',
          reason: 'cosmetics-refund',
          amount: 60,
          at: '2026-11-02T04:30:00Z',
          note: 'frame-sprout',
        },
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
      { id: 'frame-tiger', slot: 'frame', price: 200 },
      { id: 'frame-pixel', slot: 'frame', price: 200 },
      { id: 'frame-racer', slot: 'frame', price: 200 },
      { id: 'frame-orbit', slot: 'frame', price: 200 },
      { id: 'frame-slime', slot: 'frame', price: 200 },
      { id: 'accent-forest', slot: 'accent', price: 160 },
      { id: 'accent-violet', slot: 'accent', price: 160 },
      { id: 'accent-racing', slot: 'accent', price: 160 },
      { id: 'accent-ocean', slot: 'accent', price: 160 },
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
    next.wallet.balance = 200;
    next.wallet.earned = 200;
    mocks.update.mockImplementation((action) => ({
      send: async () => {
        next = structuredClone(next);
        if (action.action === 'buy') {
          next.wallet.balance = 0;
          next.wallet.owned = ['frame-tiger'];
        } else if (action.action === 'equip')
          next.wallet.equipped.frame = action.id;
        else delete next.wallet.equipped.frame;
        return next;
      },
    }));
    renderPage(next);
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Confirm redemption · 200 coins',
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
      id: 'frame-tiger',
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
    expect(screen.getByText('Your balance').parentElement).toHaveTextContent(
      '0 coins'
    );
  });

  it('disables unaffordable items and shows server errors without inventing a balance change', async () => {
    mocks.update.mockReturnValue({
      send: async () => ({
        error: { name: 'RewardError', message: 'insufficient-coins' },
      }),
    });
    const data = fixture();
    data.wallet.balance = 160;
    data.wallet.earned = 160;
    renderPage(data);
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    expect(
      screen.getByRole('button', { name: 'Confirm redemption · 200 coins' })
    ).toBeDisabled();
    expect(
      screen.getByText('Save 40 more coins by completing learning tasks.')
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Block forest theme' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm redemption · 160 coins' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You need more coins'
    );
    expect(screen.getByText('Your balance').parentElement).toHaveTextContent(
      '160 coins'
    );
    expect(
      screen.queryByRole('button', { name: 'Equip' })
    ).not.toBeInTheDocument();
  });

  it('groups shop items by category and filters to a single category', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    for (const name of ['Avatar frame', 'Theme']) {
      expect(await screen.findByRole('region', { name })).toBeVisible();
    }
    expect(
      screen.queryByRole('region', { name: 'Name background' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Personal title' })
    ).not.toBeInTheDocument();
    const frames = screen.getByRole('region', { name: 'Avatar frame' });
    expect(
      within(frames).getByRole('button', { name: 'Preview Little tiger frame' })
    ).toBeVisible();
    expect(
      within(frames).getByRole('button', {
        name: 'Preview Pixel explorer frame',
      })
    ).toBeVisible();
    expect(within(frames).getByText('0 of 5 owned')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Theme' }));
    expect(
      screen.queryByRole('region', { name: 'Avatar frame' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Theme' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByRole('region', { name: 'Avatar frame' })).toBeVisible();
  });

  it('draws the tiger and pixel frames around the previewed avatar', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'Preview Little tiger frame' })
    );
    const preview = screen.getByRole('complementary', {
      name: 'Appearance preview',
    });
    expect(
      preview.querySelector('[data-reward-frame="frame-tiger"]')
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: 'Preview Pixel explorer frame' })
    );
    expect(
      preview.querySelector('[data-reward-frame="frame-pixel"]')
    ).toBeVisible();
  });

  it('combines new frames and themes without buying or equipping', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    const preview = screen.getByRole('complementary', {
      name: 'Appearance preview',
    });
    for (const [frame, theme] of [
      ['Speed racer frame', 'Speed circuit theme'],
      ['Space navigator frame', 'Space voyage theme'],
      ['Sprite companion frame', 'Sprite bay theme'],
    ]) {
      await userEvent.click(
        screen.getByRole('button', { name: `Preview ${frame}` })
      );
      await userEvent.click(
        screen.getByRole('button', { name: `Preview ${theme}` })
      );
      const art = preview.querySelector(
        'img[data-reward-frame]'
      ) as HTMLImageElement;
      await waitFor(() =>
        expect(art.complete && art.naturalWidth > 0).toBe(true)
      );
      expect(art).toBeVisible();
      for (const label of within(preview).getAllByText(theme)) {
        expect(label).toBeVisible();
      }
    }
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByText('Your balance').parentElement).toHaveTextContent(
      '100 coins'
    );
  });

  it('updates the pictured frame when owned-only filtering replaces an unowned selection', async () => {
    const data = fixture();
    data.wallet.owned = ['frame-pixel', 'accent-forest'];
    renderPage(data);
    await userEvent.click(screen.getByRole('tab', { name: 'Appearance shop' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview Speed racer frame' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Preview Space voyage theme' })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Owned items only' })
    );
    const preview = screen.getByRole('complementary', {
      name: 'Appearance preview',
    });
    const frame = preview.querySelector(
      'img[data-reward-frame]'
    ) as HTMLImageElement;
    await waitFor(() =>
      expect(frame.complete && frame.naturalWidth > 0).toBe(true)
    );
    expect(frame.src).toContain('/rewards/frames/frame-pixel.svg');
    expect(within(preview).getByText('Pixel explorer frame')).toBeVisible();
    for (const label of within(preview).getAllByText('Space voyage theme')) {
      expect(label).toBeVisible();
    }
    expect(
      within(preview).getByRole('button', { name: 'Equip' })
    ).toBeVisible();
    expect(mocks.update).not.toHaveBeenCalled();
    if (import.meta.env.MODE === 'preview') {
      await page.screenshot({
        path: '../../test-results/rewards-owned-filter.png',
        element: preview,
      });
    }
  });

  it('applies equipped themes to portaled surfaces and restores defaults on removal', () => {
    const defaultBackground = getComputedStyle(document.body).backgroundColor;
    const view = render(
      <>
        <RewardThemeSync id="accent-forest" />
        {createPortal(
          <div
            role="dialog"
            aria-label="Theme sample"
            className="bg-card text-foreground"
          >
            Sample
          </div>,
          document.body
        )}
      </>
    );
    const sample = screen.getByRole('dialog', { name: 'Theme sample' });
    const forestColor = getComputedStyle(sample).backgroundColor;
    view.rerender(
      <>
        <RewardThemeSync id="accent-violet" />
        {createPortal(
          <div
            role="dialog"
            aria-label="Theme sample"
            className="bg-card text-foreground"
          >
            Sample
          </div>,
          document.body
        )}
      </>
    );
    expect(getComputedStyle(sample).backgroundColor).not.toBe(forestColor);
    view.unmount();
    expect(getComputedStyle(document.body).backgroundColor).toBe(
      defaultBackground
    );
  });

  it.each([false, true])(
    'keeps theme text and actions readable with dark mode %s',
    (dark) => {
      document.documentElement.classList.toggle('dark', dark);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      const luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        const channels = Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((channel) => {
            const value = channel / 255;
            return value <= 0.04045
              ? value / 12.92
              : ((value + 0.055) / 1.055) ** 2.4;
          });
        return (
          channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
        );
      };
      const contrast = (color: string, background: string) => {
        const values = [luminance(color), luminance(background)].sort(
          (a, b) => b - a
        );
        return (values[0] + 0.05) / (values[1] + 0.05);
      };
      try {
        render(
          <>
            {fixture()
              .catalog.filter((item) => item.slot === 'accent')
              .map((item) => (
                <section
                  key={item.id}
                  aria-label={item.id}
                  data-reward-accent={item.id}
                  className="reward-theme-canvas p-4"
                >
                  <p className="text-foreground">Learning space</p>
                  <p className="text-muted-foreground">Your next challenge</p>
                  <Button>Practice</Button>
                </section>
              ))}
          </>
        );
        for (const sample of screen.getAllByRole('region')) {
          const background = getComputedStyle(sample).backgroundColor;
          for (const text of within(sample).getAllByText(
            /Learning space|Your next challenge/
          )) {
            expect(
              contrast(getComputedStyle(text).color, background)
            ).toBeGreaterThanOrEqual(4.5);
          }
          const action = getComputedStyle(within(sample).getByRole('button'));
          expect(
            contrast(action.color, action.backgroundColor)
          ).toBeGreaterThanOrEqual(4.5);
        }
      } finally {
        document.documentElement.classList.remove('dark');
      }
    }
  );

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
        expect(
          screen.getByText('Adjustment by coach: Weekly prize')
        ).toBeVisible();
        expect(screen.getByText('Refund: Sprout frame')).toBeVisible();
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      } finally {
        await page.viewport(1280, 900);
      }
    }
  );
});

describe.runIf(import.meta.env.MODE === 'preview')('PR previews', () => {
  it.each([
    ['desktop', 1440, 'accent-forest', 'frame-pixel', false],
    ['space', 1440, 'accent-violet', 'frame-orbit', false],
    ['racing', 1440, 'accent-racing', 'frame-racer', false],
    ['ocean', 1440, 'accent-ocean', 'frame-slime', false],
    ['dark', 1440, 'accent-violet', 'frame-orbit', true],
    ['mobile', 390, 'accent-ocean', 'frame-slime', false],
  ] as const)('captures %s', async (name, width, theme, frame, dark) => {
    await page.viewport(width, 1100);
    const font = await new FontFace(
      'Inter',
      'url("/fonts/Inter[opsz,wght].ttf")'
    ).load();
    document.fonts.add(font);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    const data = fixture();
    data.wallet.balance = 360;
    data.wallet.earned = 720;
    data.wallet.spent = 360;
    data.wallet.owned = [frame, theme];
    data.wallet.equipped = { frame, accent: theme };
    const user = {
      _id: 2,
      uname: '小小冒险家',
      mail: '',
      avatar: 'preview',
      rewardEquipment: data.wallet.equipped,
    };
    const view = render(
      <NextIntlClientProvider
        locale="zh"
        messages={zhMessages}
        timeZone="Asia/Shanghai"
      >
        <SidebarProvider
          data-reward-accent={theme}
          style={{ fontFamily: 'Inter, "Microsoft YaHei", sans-serif' }}
        >
          <RewardThemeSync id={theme} />
          <Sidebar>
            <SidebarHeader className="px-6 py-7 text-xl font-bold text-primary">
              YCOJ
            </SidebarHeader>
            <SidebarContent className="gap-1 px-3">
              {[
                [Home, '首页'],
                [Code2, '题库'],
                [Dumbbell, '训练'],
                [Coins, '成长与金币'],
              ].map(([Icon, label]) => (
                <div
                  key={String(label)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${label === '成长与金币' ? 'bg-sidebar-accent font-medium text-sidebar-primary' : 'text-muted-foreground'}`}
                >
                  {typeof Icon !== 'string' && <Icon className="size-4" />}
                  {String(label)}
                </div>
              ))}
            </SidebarContent>
            <SidebarFooter className="flex-row items-center gap-3 px-6 py-5">
              <UserAvatar user={user} />
              <span className="text-sm">{user.uname}</span>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="reward-theme-canvas px-4 py-6 md:p-8">
            <p className="mb-5 text-xs text-muted-foreground">
              界面预览 · 示例账号
            </p>
            <RewardsPage initialData={data} user={user} />
          </SidebarInset>
        </SidebarProvider>
      </NextIntlClientProvider>
    );
    try {
      await userEvent.click(screen.getByRole('tab', { name: '装扮商店' }));
      await userEvent.click(
        screen.getByRole('button', {
          name: `预览${zhMessages.rewards.items[frame].name}`,
        })
      );
      await waitFor(() => {
        for (const img of document.querySelectorAll('img'))
          expect(img.complete && img.naturalWidth > 0).toBe(true);
      });
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      const surface = document.querySelector(
        '[data-slot="sidebar-wrapper"]'
      ) as HTMLElement;
      await page.viewport(width, Math.max(1100, surface.scrollHeight + 32));
      window.scrollTo(0, 0);
      await page.screenshot({
        path: `../../test-results/rewards-${name}.png`,
        element: surface,
      });
    } finally {
      view.unmount();
      document.fonts.delete(font);
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = '';
      await page.viewport(1280, 900);
    }
  });
});
