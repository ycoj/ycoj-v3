import LostpassResetForm from './lostpass-reset-form';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  send: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@/api/client/method/auth/lostpass', () => ({
  resetPassword: mocks.reset,
}));
vi.mock('@/features/auth/navigate', () => ({ hardNavigate: mocks.navigate }));

function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LostpassResetForm code="token-1" uname="alice" />
    </NextIntlClientProvider>
  );
}

describe('LostpassResetForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.reset.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ url: '/' });
  });

  it('resets the password and returns to the home page', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Password'), 'newsecret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'newsecret');
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    );

    await waitFor(() =>
      expect(mocks.reset).toHaveBeenCalledWith({
        code: 'token-1',
        password: 'newsecret',
        verifyPassword: 'newsecret',
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/home');
  });

  it('names the account being recovered', () => {
    show();
    expect(
      screen.getByText(
        'Set a new password for alice. This also removes two-step verification.'
      )
    ).toBeInTheDocument();
  });

  it('rejects a short password before contacting the backend', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'short');
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    );

    expect(
      await screen.findByText('Use at least 6 characters.')
    ).toBeInTheDocument();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Password'), 'newsecret');
    await userEvent.type(
      screen.getByLabelText('Repeat password'),
      'othersecret'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    );

    expect(
      await screen.findByText('The passwords do not match.')
    ).toBeInTheDocument();
    expect(mocks.reset).not.toHaveBeenCalled();
  });

  it('explains an expired reset link', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'InvalidTokenError', message: 'The token is invalid.' },
    });
    show();
    await userEvent.type(screen.getByLabelText('Password'), 'newsecret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'newsecret');
    await userEvent.click(
      screen.getByRole('button', { name: 'Reset password' })
    );

    expect(
      await screen.findByText('This code is invalid or has expired.')
    ).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
