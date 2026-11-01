import ProblemHackForm from './problem-hack-form';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
  send: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/api/client/method/problem/hack', async () => {
  const actual = await vi.importActual<
    typeof import('@/api/client/method/problem/hack')
  >('@/api/client/method/problem/hack');
  return {
    ...actual,
    submitProblemHack: (...args: unknown[]) => {
      mocks.submit(...args);
      return { send: mocks.send };
    },
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemHackForm pid="P1000" rid={'r'.repeat(24)} tid={'c'.repeat(24)} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('ProblemHackForm', () => {
  it('submits pasted input with the contest context', async () => {
    mocks.send.mockResolvedValue({ rid: 'h'.repeat(24) });
    mount();

    await userEvent.type(screen.getByLabelText('Input'), '1 2');
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Auto organize input' })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit hack' }));

    expect(mocks.submit).toHaveBeenCalledWith(
      'P1000',
      'r'.repeat(24),
      expect.objectContaining({
        input: '1 2',
        autoOrganizeInput: true,
        tid: 'c'.repeat(24),
      })
    );
    expect(mocks.push).toHaveBeenCalledWith(`/record/${'h'.repeat(24)}`);
  });

  it('requires input before submitting', async () => {
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Submit hack' }));

    expect(
      await screen.findByText('Enter input or choose an input file.')
    ).toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it('shows backend hack failures inline', async () => {
    mocks.send.mockResolvedValue({
      error: {
        name: 'HackFailedError',
        message: 'Hack failed: You cannot hack your own submission',
      },
    });
    mount();

    await userEvent.type(screen.getByLabelText('Input'), '1 2');
    await userEvent.click(screen.getByRole('button', { name: 'Submit hack' }));

    expect(
      await screen.findByText(
        'Hack failed: You cannot hack your own submission'
      )
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('rejects oversized input files before uploading', async () => {
    mount();
    const oversized = new File(['x'], 'big.in');
    Object.defineProperty(oversized, 'size', { value: 2 * 1024 * 1024 + 1 });

    await userEvent.upload(
      screen.getByLabelText('Or upload an input file'),
      oversized
    );

    expect(await screen.findByText(/larger than 2 MiB/)).toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
