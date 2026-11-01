import ProblemStarButton from './problem-star-button';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  star: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/api/client/method/problem/actions', () => ({
  starProblem: (...args: unknown[]) => {
    mocks.star(...args);
    return { send: mocks.send };
  },
  rejudgeProblem: vi.fn(),
}));

function mount(initialStarred: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemStarButton pid="P1000" initialStarred={initialStarred} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('ProblemStarButton', () => {
  it('stars an unstarred problem', async () => {
    mocks.send.mockResolvedValue({ star: true });
    mount(false);

    await userEvent.click(
      screen.getByRole('button', { name: 'Star this problem' })
    );

    expect(mocks.star).toHaveBeenCalledWith('P1000', true);
    expect(
      await screen.findByRole('button', { name: 'Remove star' })
    ).toBeInTheDocument();
  });

  it('unstars a starred problem', async () => {
    mocks.send.mockResolvedValue({ star: false });
    mount(true);

    await userEvent.click(screen.getByRole('button', { name: 'Remove star' }));

    expect(mocks.star).toHaveBeenCalledWith('P1000', false);
    expect(
      await screen.findByRole('button', { name: 'Star this problem' })
    ).toBeInTheDocument();
  });

  it('reveals the existing state through aria-pressed', () => {
    mount(true);
    expect(screen.getByRole('button', { name: 'Remove star' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  it('reverts the optimistic change when the backend rejects it', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'PermissionError', message: 'Permission denied' },
    });
    mount(false);

    await userEvent.click(
      screen.getByRole('button', { name: 'Star this problem' })
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied'
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Star this problem' })
      ).toHaveAttribute('aria-pressed', 'false')
    );
  });
});
