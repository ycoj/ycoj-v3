import ContestRejudge from './contest-rejudge';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@/api/client/method', () => ({
  default: {
    Contest: {
      rejudgeContest: (...args: unknown[]) => {
        mocks.request(...args);
        return { send: mocks.send };
      },
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));

function mount() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContestRejudge tid="contest" />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('contest rejudge', () => {
  it('requires confirmation, allows canceling, and reports the queued count', async () => {
    mocks.send.mockResolvedValue({ count: 3 });
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    expect(mocks.request).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mocks.request).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm rejudge' })
    );
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        '3 submissions queued for rejudging'
      )
    );
    expect(mocks.request).toHaveBeenCalledWith('contest');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it('shows backend failures and allows retrying without reporting success', async () => {
    mocks.send.mockResolvedValue({ error: { message: 'Permission denied' } });
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm rejudge' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied'
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Confirm rejudge' })
    ).toBeEnabled();
  });

  it('disables confirmation while queueing', async () => {
    let resolve: (value: { count: number }) => void = () => {};
    mocks.send.mockReturnValue(
      new Promise<{ count: number }>((done) => {
        resolve = done;
      })
    );
    mount();
    await userEvent.click(
      screen.getByRole('button', { name: 'Rejudge all submissions' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirm rejudge' })
    );
    expect(screen.getByRole('button', { name: 'Queueing...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    resolve({ count: 0 });
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith(
        '0 submissions queued for rejudging'
      )
    );
  });
});
