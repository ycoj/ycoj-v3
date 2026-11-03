import '@/app/globals.css';
import ProblemFilterBar from './problem-filter-bar';
import type { ProblemFilters } from './problem-filter-utils';
import messages from '@/messages/en';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  random: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => '/problem',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/api/client/method/problem/random', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('@/api/client/method/problem/random')>();
  return {
    ...original,
    getRandomProblem: () => ({ send: mocks.random }),
  };
});

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: mocks.toastError },
}));

const filters: ProblemFilters = {
  q: '',
  category: [],
  difficulty: [],
  namespace: '',
  sort: 'default',
  dir: 'asc',
  showTags: false,
  page: 1,
};

const categories = { dp: ['knapsack', 'tree'], graph: [] };

function renderBar(overrides: Partial<ProblemFilters> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemFilterBar
        filters={{ ...filters, ...overrides }}
        categories={categories}
        namespaces={['legacy', 'modern']}
      />
    </NextIntlClientProvider>
  );
}

describe('problem filter bar', () => {
  beforeEach(() => {
    mocks.random.mockResolvedValue({ url: '/p/P1000' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('adds a category to the shareable URL', async () => {
    renderBar();
    await userEvent.click(screen.getByRole('button', { name: /Category/ }));

    const popover = screen.getByRole('dialog');
    await userEvent.click(
      within(popover).getByRole('button', { name: 'knapsack' })
    );

    expect(mocks.push).toHaveBeenCalledWith('/problem?category=knapsack');
  });

  it('marks the selected category as pressed', async () => {
    renderBar({ category: ['dp'] });
    await userEvent.click(screen.getByRole('button', { name: /Category/ }));
    const popover = screen.getByRole('dialog');
    expect(within(popover).getByRole('button', { name: 'dp' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      within(popover).getByRole('button', { name: 'knapsack' })
    ).toHaveAttribute('aria-pressed', 'false');
  });

  it('joins the sort menu to the direction button on a square right edge', () => {
    renderBar();
    const sort = screen.getByRole('combobox', { name: 'Sort' });
    const direction = screen.getByRole('button', { name: 'Ascending' });
    const sortStyle = getComputedStyle(sort);
    const directionStyle = getComputedStyle(direction);

    expect(sortStyle.borderTopRightRadius).toBe('0px');
    expect(sortStyle.borderBottomRightRadius).toBe('0px');
    expect(Number.parseFloat(sortStyle.borderTopLeftRadius)).toBeGreaterThan(0);
    expect(directionStyle.borderTopLeftRadius).toBe('0px');
    expect(directionStyle.borderBottomLeftRadius).toBe('0px');
    expect(
      Math.abs(
        sort.getBoundingClientRect().top - direction.getBoundingClientRect().top
      )
    ).toBeLessThan(2);
  });

  it('switches to the newest-first ordering', async () => {
    renderBar();
    await userEvent.click(screen.getByRole('combobox', { name: 'Sort' }));
    await userEvent.click(screen.getByRole('option', { name: 'Newest first' }));

    expect(mocks.push).toHaveBeenCalledWith('/problem?sort=recent');
  });

  it('resets every active filter', async () => {
    renderBar({ category: ['dp'], difficulty: [3], namespace: 'legacy' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset filters' })
    );
    expect(mocks.push).toHaveBeenCalledWith('/problem');
  });

  it('picks a random problem under the selected categories', async () => {
    renderBar({ category: ['dp', 'graph'] });
    await userEvent.click(
      screen.getByRole('button', { name: 'Pick a random problem' })
    );

    await waitFor(() => expect(mocks.random).toHaveBeenCalledTimes(1));
    expect(mocks.push).toHaveBeenCalledWith('/problem/P1000');
  });

  it('reports when no random problem matches', async () => {
    mocks.random.mockResolvedValueOnce({
      error: { name: 'NoProblemError', message: 'No problem' },
    });
    renderBar();
    await userEvent.click(
      screen.getByRole('button', { name: 'Pick a random problem' })
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        'No problem matched the current filters.'
      )
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('flips the direction to the other server ordering', async () => {
    renderBar();
    await userEvent.click(screen.getByRole('button', { name: 'Ascending' }));
    // serializeProblemFilters omits a direction equal to the ordering default.
    expect(mocks.push).toHaveBeenCalledWith('/problem?sort=recent');
  });

  it('flips the newest-first ordering back to problem order', async () => {
    renderBar({ sort: 'recent', dir: 'desc' });
    await userEvent.click(screen.getByRole('button', { name: 'Descending' }));
    expect(mocks.push).toHaveBeenCalledWith('/problem');
  });
});
