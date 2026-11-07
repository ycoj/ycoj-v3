import '@/app/globals.css';
import DomainCoinsPage from './domain-coins-page';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adjust: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Domain: {
      adjustDomainCoins: mocks.adjust,
    },
  },
}));

vi.mock('@/features/user/user-auto-complete', () => ({
  default: ({
    ariaLabel,
    onValueChange,
  }: {
    ariaLabel: string;
    onValueChange: (value: string[]) => void;
  }) => (
    <button type="button" onClick={() => onValueChange(['12', '13'])}>
      {ariaLabel}
    </button>
  ),
}));

function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DomainCoinsPage
        data={{ domain: { _id: 'school', name: 'School' } }}
        domainId="school"
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('domain coin adjustments', () => {
  it('asks for members, an amount, and a reason before sending', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));
    expect(
      screen.getByText('Select at least one joined member.')
    ).toBeVisible();
    expect(
      screen.getByText('Enter a whole number from 1 to 100,000.')
    ).toBeVisible();
    expect(
      screen.getByText('Enter a reason, up to 200 characters.')
    ).toBeVisible();
    expect(mocks.adjust).not.toHaveBeenCalled();
  });

  it('sends a deduction and shows each new balance', async () => {
    const user = userEvent.setup();
    mocks.adjust.mockReturnValue({
      send: () =>
        Promise.resolve({
          adjustments: [
            { uid: 12, amount: -20, balance: -5, applied: true },
            { uid: 13, amount: -20, balance: 80, applied: false },
          ],
        }),
    });
    mount();
    await user.click(screen.getByRole('radio', { name: 'Deduct' }));
    await user.type(screen.getByLabelText('Amount'), '20');
    await user.click(screen.getByRole('button', { name: 'Members' }));
    await user.type(
      screen.getByLabelText('Reason'),
      'Missed the weekly practice'
    );
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));

    expect(mocks.adjust).toHaveBeenCalledWith({
      uids: [12, 13],
      direction: 'deduct',
      amount: 20,
      reason: 'Missed the weekly practice',
      requestId: expect.stringMatching(/^[A-Za-z0-9_-]{8,80}$/),
    });
    expect(screen.getByText('UID 12: -20 coins, balance -5')).toBeVisible();
    expect(
      screen.getByText('This request was already recorded.')
    ).toBeVisible();
    expect(screen.getByLabelText('Reason')).toHaveValue('');
  });

  it('shows the server reason when a selected user has not joined', async () => {
    const user = userEvent.setup();
    mocks.adjust.mockReturnValue({
      send: () =>
        Promise.resolve({
          error: { name: 'RewardError', message: 'user-not-in-domain' },
        }),
    });
    mount();
    await user.type(screen.getByLabelText('Amount'), '10');
    await user.click(screen.getByRole('button', { name: 'Members' }));
    await user.type(screen.getByLabelText('Reason'), 'Class prize');
    await user.click(screen.getByRole('button', { name: 'Apply adjustment' }));
    expect(
      screen.getByText(
        'Every selected user must already have joined this domain.'
      )
    ).toBeVisible();
  });
});
