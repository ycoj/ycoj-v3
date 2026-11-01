import { LoginPage } from './login-page';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  send: vi.fn(),
  tfa: vi.fn(),
  sendTfa: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@/api/client/method', () => ({
  default: {
    Auth: { login: mocks.login, getTfaMethods: mocks.tfa },
  },
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/shared/components/ui/checkbox', () => ({ Checkbox: () => null }));
vi.mock('@/features/auth/navigate', () => ({ hardNavigate: mocks.navigate }));
vi.mock('./resolve-login-redirect', () => ({
  resolveLoginRedirect: () => '/home',
}));

function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <LoginPage />
    </NextIntlClientProvider>
  );
}

async function signIn() {
  await userEvent.type(screen.getByLabelText('Username'), 'alice');
  await userEvent.type(screen.getByLabelText('Password'), 'secret');
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginPage two-step verification', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.login.mockReturnValue({ send: mocks.send });
    mocks.tfa.mockReturnValue({ send: mocks.sendTfa });
    mocks.sendTfa.mockResolvedValue({ tfa: true, authn: false });
  });

  it('asks for a code when the account needs a second factor', async () => {
    mocks.send
      .mockResolvedValueOnce({
        error: { name: 'ValidationError', params: ['2FA', 'Authn'] },
      })
      .mockResolvedValueOnce({ url: '/home' });
    show();
    await signIn();

    expect(
      await screen.findByRole('heading', { name: 'Two-step verification' })
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Verification code'), '123456');
    await userEvent.click(
      screen.getByRole('button', { name: 'Verify and sign in' })
    );

    await waitFor(() =>
      expect(mocks.login).toHaveBeenLastCalledWith({
        uname: 'alice',
        password: 'secret',
        rememberme: false,
        redirect: '/home',
        tfa: '123456',
      })
    );
    expect(mocks.navigate).toHaveBeenCalledWith('/home');
  });

  it('offers a security key when the account registered one', async () => {
    mocks.sendTfa.mockResolvedValue({ tfa: true, authn: true });
    mocks.send.mockResolvedValueOnce({
      error: { name: 'ValidationError', params: ['2FA'] },
    });
    show();
    await signIn();

    expect(
      await screen.findByRole('button', { name: 'Use security key' })
    ).toBeInTheDocument();
  });

  it('rejects an incomplete code without resubmitting', async () => {
    mocks.send.mockResolvedValueOnce({
      error: { name: 'ValidationError', params: ['2FA'] },
    });
    show();
    await signIn();

    await userEvent.type(
      await screen.findByLabelText('Verification code'),
      '12'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Verify and sign in' })
    );

    expect(
      await screen.findByText(
        'Enter the 6-digit code from your authenticator app.'
      )
    ).toBeInTheDocument();
    expect(mocks.login).toHaveBeenCalledTimes(1);
  });

  it('reports a wrong code and keeps the form available', async () => {
    mocks.send
      .mockResolvedValueOnce({
        error: { name: 'ValidationError', params: ['2FA'] },
      })
      .mockResolvedValueOnce({
        error: {
          name: 'InvalidTokenError',
          message: 'The 2FA Token is invalid.',
        },
      });
    show();
    await signIn();

    await userEvent.type(
      await screen.findByLabelText('Verification code'),
      '000000'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Verify and sign in' })
    );

    expect(
      await screen.findByText('The 2FA Token is invalid.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });
});

describe('LoginPage recovery entry points', () => {
  beforeEach(() => vi.resetAllMocks());

  it('links to password recovery and account creation', () => {
    show();
    expect(
      screen.getByRole('link', { name: 'Forgot password?' })
    ).toHaveAttribute('href', '/lostpass');
    expect(
      screen.getByRole('link', { name: 'Create account' })
    ).toHaveAttribute('href', '/register');
  });

  it('links third-party providers to the backend sign-in start', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LoginPage providers={[{ id: 'github', text: 'GitHub' }]} />
      </NextIntlClientProvider>
    );
    expect(screen.getByRole('link', { name: 'GitHub' })).toHaveAttribute(
      'href',
      '/oauth/github/login'
    );
  });

  it('hides the local form when username/password sign-in is disabled', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <LoginPage
          builtInLogin={false}
          providers={[{ id: 'github', text: 'GitHub' }]}
        />
      </NextIntlClientProvider>
    );
    expect(screen.queryByLabelText('Username')).toBeNull();
    expect(screen.getByRole('link', { name: 'GitHub' })).toBeInTheDocument();
  });
});
