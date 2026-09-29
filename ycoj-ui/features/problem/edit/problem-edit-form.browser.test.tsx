import ProblemEditForm from './problem-edit-form';
import messages from '@/messages/en';
import type { PublicProjectionProblem } from '@/shared/types/problem';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  edit: vi.fn(),
  delete: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Problem: {
      editProblem: (pid: string, payload: unknown) => ({
        send: () => mocks.edit(pid, payload),
      }),
      deleteProblem: (pid: string) => ({ send: () => mocks.delete(pid) }),
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@/features/problem/form/html-to-markdown-section', () => ({
  default: () => null,
}));

const problem: PublicProjectionProblem = {
  _id: '66b5c0e00000000000000000',
  domainId: 'system',
  docType: 10,
  docId: 1000,
  pid: 'P1000',
  owner: 1,
  title: 'A + B',
  nSubmit: 0,
  nAccept: 0,
  difficulty: 1,
  tag: ['math'],
  hidden: false,
  content: 'Given two integers, print their sum.',
  data: [],
  config: {
    count: 1,
    memoryMax: 256,
    memoryMin: 256,
    timeMax: 1000,
    timeMin: 1000,
    type: 'default',
  },
};

function renderEdit() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemEditForm problem={problem} tags={{ math: ['algebra'] }} />
    </NextIntlClientProvider>
  );
}

async function confirmDelete() {
  await userEvent.click(screen.getByRole('button', { name: 'Delete problem' }));
  const dialog = screen.getByRole('alertdialog', { name: 'Delete problem' });
  await userEvent.click(
    within(dialog).getByRole('button', { name: 'Delete problem' })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.delete.mockResolvedValue({});
});

describe('problem edit form', () => {
  it('renders the delete action for the current problem', () => {
    renderEdit();
    expect(
      screen.getByRole('button', { name: 'Delete problem' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Back to problem/ })
    ).toHaveAttribute('href', '/problem/P1000');
  });

  it.each(['/p', '/d/class/p'])(
    'deletes the problem and returns to the problem list from %s',
    async (listUrl) => {
      mocks.delete.mockResolvedValue({ url: listUrl });
      renderEdit();
      await confirmDelete();
      await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith('P1000'));
      expect(mocks.push).toHaveBeenCalledWith('/problem');
      expect(mocks.refresh).toHaveBeenCalled();
    }
  );

  it('honors a backend redirect instead of faking a deletion', async () => {
    mocks.delete.mockResolvedValue({ url: '/login?redirect=%2Fhome' });
    renderEdit();
    await confirmDelete();
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/login?redirect=%2Fhome')
    );
    expect(mocks.push).not.toHaveBeenCalledWith('/problem');
  });

  it('shows deletion errors without navigating', async () => {
    mocks.delete.mockResolvedValue({
      error: { name: 'ProblemAlreadyUsedByContestError', message: 'In use' },
    });
    renderEdit();
    await confirmDelete();
    const dialog = screen.getByRole('alertdialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'In use'
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
