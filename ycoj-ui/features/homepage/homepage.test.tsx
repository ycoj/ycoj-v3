import Homepage from '@/features/homepage/homepage';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getHomepage: vi.fn(),
}));

vi.mock('@/features/user/lib/get-user', () => ({ getUser: mocks.getUser }));
vi.mock('@/api/server/method', () => ({
  default: { UI: { getHomepage: mocks.getHomepage } },
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock('./components/banner', () => ({ default: () => null }));
vi.mock('./components/blogs', () => ({ default: () => null }));
vi.mock('./components/bulletin', () => ({ default: () => null }));
vi.mock('./components/contests', () => ({ default: () => null }));
vi.mock('./components/countdown', () => ({ default: () => null }));
vi.mock('./components/daily-checkin', () => ({
  default: ({ username }: { username: string }) => (
    <div data-testid="checkin">{username}</div>
  ),
}));
vi.mock('./components/discussion-nodes', () => ({ default: () => null }));
vi.mock('./components/discussions', () => ({ default: () => null }));
vi.mock('./components/homework', () => ({ default: () => null }));
vi.mock('./components/hitokoto', () => ({ default: () => null }));
vi.mock('./components/ranking', () => ({ default: () => null }));
vi.mock('./components/recent-problems', () => ({ default: () => null }));
vi.mock('./components/starred-problems', () => ({ default: () => null }));
vi.mock('./components/suggestions', () => ({ default: () => null }));
vi.mock('./components/training', () => ({ default: () => null }));

beforeEach(() => {
  vi.resetAllMocks();
});

function renderColumns(homepage: unknown) {
  mocks.getUser.mockResolvedValue({ _id: 2, uname: 'alice', priv: 0 });
  mocks.getHomepage.mockResolvedValue(homepage);
  return Homepage();
}

describe('Homepage access', () => {
  it.each([undefined, null, { _id: 0, uname: 'guest' }])(
    'redirects guests before rendering (%j)',
    async (user) => {
      mocks.getUser.mockResolvedValue(user);
      mocks.getHomepage.mockResolvedValue({ url: '/login' });

      await expect(Homepage()).rejects.toThrow('redirect:/login');
      expect(mocks.getHomepage).toHaveBeenCalledTimes(1);
    }
  );

  it('requests homepage data while the user check is pending', async () => {
    let resolveUser!: (user: undefined) => void;
    mocks.getUser.mockReturnValue(
      new Promise<undefined>((resolve) => {
        resolveUser = resolve;
      })
    );
    mocks.getHomepage.mockResolvedValue({ url: '/login' });

    const result = Homepage();
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.getHomepage).toHaveBeenCalledTimes(1);

    resolveUser(undefined);

    await expect(result).rejects.toThrow('redirect:/login');
    expect(mocks.getHomepage).toHaveBeenCalledTimes(1);
  });
});

describe('Homepage layout', () => {
  const base = {
    udict: {},
    domain: { bulletin: 'Welcome' },
    checkin: { canCheckin: true, record: null, streak: 0 },
  };

  it('preserves the server column widths and order', async () => {
    const page = await renderColumns({
      ...base,
      contents: [
        {
          width: 9,
          sections: [
            ['contest', [[], {}]],
            ['homework', [[], {}]],
          ],
        },
        {
          width: 3,
          sections: [
            ['hitokoto', true],
            ['starred_problems', [[]]],
          ],
        },
      ],
    });

    const columns = page.props.columns;
    // Two configured columns plus the sidebar check-in card.
    expect(columns).toHaveLength(2);
    expect(columns[0]).toHaveLength(2);
    expect(columns[1]).toHaveLength(3);
    // 9/3 remains 9/3 on the 12-column grid.
    expect(page.props.spans).toEqual([9, 3]);
  });

  it('skips sections this UI cannot render', async () => {
    const page = await renderColumns({
      ...base,
      contents: [
        { width: 12, sections: [['custom_widget', {}]] },
        { width: 12, sections: [['bulletin', true]] },
      ],
    });

    const columns = page.props.columns;
    // Only the configured column survives; the check-in joins it.
    expect(columns).toHaveLength(1);
    expect(page.props.spans).toEqual([12]);
  });

  it('scales widths that exceed one grid row', async () => {
    const page = await renderColumns({
      ...base,
      contents: [
        { width: 9, sections: [['bulletin', true]] },
        { width: 9, sections: [['hitokoto', true]] },
      ],
    });

    // Two 9-wide columns are scaled proportionally back to twelve.
    expect(page.props.spans).toEqual([6, 6]);
  });
});
