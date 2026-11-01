import LostpassRequestForm from './lostpass-request-form';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ request: vi.fn(), send: vi.fn() }));
vi.mock('@/api/client/method/auth/lostpass', () => ({
  requestPasswordReset: mocks.request,
}));

function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LostpassRequestForm />
    </NextIntlClientProvider>
  );
}

describe('LostpassRequestForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.request.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({});
  });

  it('confirms that the reset link was requested', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    );

    expect(
      await screen.findByText(
        'If an account exists for alice@example.test, a reset link is on its way.'
      )
    ).toBeInTheDocument();
  });

  it('explains when the account is unknown', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'UserNotFoundError', params: ['nobody@example.test'] },
    });
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'nobody@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    );

    expect(
      await screen.findByText('No account is registered with this email.')
    ).toBeInTheDocument();
  });

  it('validates the email before sending', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send reset link' })
    );

    expect(
      await screen.findByText('Enter a valid email address.')
    ).toBeInTheDocument();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});
