import RegisterCompleteForm from './register-complete-form';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  complete: vi.fn(),
  send: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@/api/client/method/auth/register', () => ({
  completeRegistration: mocks.complete,
}));
vi.mock('@/features/auth/navigate', () => ({ hardNavigate: mocks.navigate }));

function show(lockUsername = false) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RegisterCompleteForm
        code="token-1"
        mail="alice@example.test"
        username={lockUsername ? 'alice' : undefined}
        lockUsername={lockUsername}
      />
    </NextIntlClientProvider>
  );
}

describe('RegisterCompleteForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.complete.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ url: '/home' });
  });

  it('creates the account, signs in, and lands on a migrated page', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Username'), 'alice');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'secret');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    );

    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith({
        code: 'token-1',
        uname: 'alice',
        password: 'secret',
        verifyPassword: 'secret',
      })
    );
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home'));
  });

  it('falls back to the home page when registration points at the backend homepage', async () => {
    mocks.send.mockResolvedValue({ url: '/' });
    show();
    await userEvent.type(screen.getByLabelText('Username'), 'alice');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'secret');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    );

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/home'));
  });

  it('shows the locked username read-only and omits it from the request', async () => {
    show(true);
    const username = screen.getByLabelText('Username');
    expect(username).toHaveValue('alice');
    expect(username).toHaveAttribute('readonly');
    expect(
      screen.getByText(
        'Your username was set by the sign-in provider and cannot be changed.'
      )
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'secret');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    );

    await waitFor(() =>
      expect(mocks.complete).toHaveBeenCalledWith({
        code: 'token-1',
        password: 'secret',
        verifyPassword: 'secret',
      })
    );
  });

  it('rejects mismatched passwords without calling the backend', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Username'), 'alice');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'secret2');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    );

    expect(
      await screen.findByText('The passwords do not match.')
    ).toBeInTheDocument();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it('explains an expired token instead of staying silent', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'InvalidTokenError', message: 'The token is invalid.' },
    });
    show();
    await userEvent.type(screen.getByLabelText('Username'), 'alice');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.type(screen.getByLabelText('Repeat password'), 'secret');
    await userEvent.click(
      screen.getByRole('button', { name: 'Create account' })
    );

    expect(
      await screen.findByText('This code is invalid or has expired.')
    ).toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});
