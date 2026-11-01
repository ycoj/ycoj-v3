import ProblemRejudgeButton from './problem-rejudge-button';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rejudge: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@/api/client/method/problem/actions', () => ({
  rejudgeProblem: (...args: unknown[]) => {
    mocks.rejudge(...args);
    return { send: mocks.send };
  },
  starProblem: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));

function mount(tid?: string) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemRejudgeButton docId={1000} tid={tid} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('ProblemRejudgeButton', () => {
  it('requires confirmation before queueing the rejudge', async () => {
    mocks.send.mockResolvedValue({});
    mount();

    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    expect(mocks.rejudge).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.rejudge).not.toHaveBeenCalled();

    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rejudge all' }));

    expect(mocks.rejudge).toHaveBeenCalledWith(1000, undefined);
    expect(mocks.success).toHaveBeenCalledWith(
      'Submissions were queued for rejudging.'
    );
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('passes the contest context through', async () => {
    mocks.send.mockResolvedValue({});
    mount('c'.repeat(24));

    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rejudge all' }));

    expect(mocks.rejudge).toHaveBeenCalledWith(1000, 'c'.repeat(24));
  });

  it('shows backend failures without refreshing', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'PermissionError', message: 'Permission denied' },
    });
    mount();

    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rejudge all' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied'
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
