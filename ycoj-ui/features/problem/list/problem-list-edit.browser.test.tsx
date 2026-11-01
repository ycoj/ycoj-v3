import '@/app/globals.css';
import ProblemList from './problem-list';
import type { ProblemListResponse } from '@/api/server/method/problems/list';
import type { ProblemFilters } from '@/features/problem/list/problem-filter-utils';
import messages from '@/messages/en';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bulk: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  downloadPackages: vi.fn(),
}));

vi.mock('@/api/client/method/problem/batch', () => ({
  bulkUpdateProblems: (operation: string, pids: number[]) => ({
    send: () => mocks.bulk(operation, pids),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
  usePathname: () => '/problem',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock('@/features/problem/package/download-problem-packages', () => ({
  downloadProblemPackages: mocks.downloadPackages,
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

function makeProblem(
  docId: number,
  overrides: Partial<ProblemListResponse['pdocs'][number]> = {}
) {
  return {
    _id: `${docId}`.padEnd(24, '0'),
    domainId: 'system',
    docType: 10 as const,
    docId,
    pid: `P${docId}`,
    owner: 1,
    title: `Problem ${docId}`,
    nSubmit: 10,
    nAccept: 5,
    tag: [],
    hidden: false,
    ...overrides,
  } as ProblemListResponse['pdocs'][number];
}

function makeData(pdocs: ProblemListResponse['pdocs']): ProblemListResponse {
  return {
    page: 1,
    pcount: pdocs.length,
    ppcount: 1,
    pcountRelation: 'eq',
    pdocs,
    psdict: {},
    qs: '',
  };
}

function renderList(
  data: ProblemListResponse,
  props: Partial<Parameters<typeof ProblemList>[0]> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemList
        data={data}
        showTags={false}
        filters={filters}
        domainId="system"
        canManageAll
        canManageOwn
        userId={1}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

async function enterEditMode() {
  await userEvent.click(screen.getByRole('button', { name: 'Edit problems' }));
}

describe('problem list edit mode', () => {
  beforeEach(() => {
    mocks.bulk.mockResolvedValue({});
    mocks.downloadPackages.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('only offers edit mode to users who can manage problems', () => {
    renderList(makeData([makeProblem(1000)]), {
      canManageAll: false,
      canManageOwn: false,
    });
    expect(
      screen.queryByRole('button', { name: 'Edit problems' })
    ).not.toBeInTheDocument();
  });

  it('selects problems and hides them in one action', async () => {
    renderList(makeData([makeProblem(1000), makeProblem(1001)]));
    await enterEditMode();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select P1000' })
    );
    expect(screen.getByText('1 problem selected')).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));

    await waitFor(() =>
      expect(mocks.bulk).toHaveBeenCalledWith('hide', [1000])
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('1 problem hidden');
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByText('No problems selected')).toBeVisible();
  });

  it('selects the whole page with the header checkbox', async () => {
    renderList(makeData([makeProblem(1000), makeProblem(1001)]));
    await enterEditMode();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all problems on this page' })
    );
    expect(screen.getByText('2 problems selected')).toBeVisible();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all problems on this page' })
    );
    expect(screen.getByText('No problems selected')).toBeVisible();
  });

  it('offers unhide only for hidden problems and hide only for visible ones', async () => {
    renderList(
      makeData([makeProblem(1000), makeProblem(1001, { hidden: true })])
    );
    await enterEditMode();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select P1000' })
    );
    expect(screen.getByRole('button', { name: 'Hide' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Unhide' })
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select P1001' })
    );
    expect(screen.getByRole('button', { name: 'Hide' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unhide' })).toBeVisible();
  });

  it('leaves edit mode and clears the selection', async () => {
    renderList(makeData([makeProblem(1000)]));
    await enterEditMode();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select P1000' })
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Leave edit mode' })
    );

    expect(
      screen.queryByRole('checkbox', { name: 'Select P1000' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit problems' })).toBeVisible();
  });

  it('lets owners of a problem manage and delete it', async () => {
    renderList(makeData([makeProblem(1000)]), {
      canManageAll: false,
      canManageOwn: true,
      userId: 1,
    });
    await enterEditMode();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select P1000' })
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeVisible();
  });

  it('only allows self-owners to select their own problems', async () => {
    renderList(
      makeData([
        makeProblem(1000, { owner: 1 }),
        makeProblem(1001, { owner: 2 }),
      ]),
      {
        canManageAll: false,
        canManageOwn: true,
        userId: 1,
      }
    );
    await enterEditMode();

    expect(
      screen.getByRole('checkbox', { name: 'Select P1000' })
    ).toBeVisible();
    expect(
      screen.queryByRole('checkbox', { name: 'Select P1001' })
    ).not.toBeInTheDocument();
  });

  it('confirms before deleting the selected problems', async () => {
    renderList(makeData([makeProblem(1000), makeProblem(1001)]));
    await enterEditMode();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all problems on this page' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Delete selected problems',
    });
    expect(
      within(dialog).getByText(
        'Permanently delete 2 problems? This cannot be undone.'
      )
    ).toBeVisible();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' })
    );

    await waitFor(() =>
      expect(mocks.bulk).toHaveBeenCalledWith('delete', [1000, 1001])
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('2 problems deleted');
  });

  it('downloads the selected problems as a package', async () => {
    renderList(makeData([makeProblem(1000), makeProblem(1001)]));
    await enterEditMode();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select all problems on this page' })
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Download package' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(mocks.downloadPackages).toHaveBeenCalledWith(
        [1000, 1001],
        'system',
        undefined
      )
    );
  });

  it('reports a failed bulk action and keeps the selection', async () => {
    mocks.bulk.mockRejectedValueOnce(new Error('Permission denied'));
    renderList(makeData([makeProblem(1000)]));
    await enterEditMode();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Select P1000' })
    );

    await userEvent.click(screen.getByRole('button', { name: 'Hide' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Permission denied')
    );
    expect(screen.getByText('1 problem selected')).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
