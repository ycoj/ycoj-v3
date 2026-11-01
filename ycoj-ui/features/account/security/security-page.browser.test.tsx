import SecurityAuthenticators from './security-authenticators';
import SecurityMailForm from './security-mail-form';
import SecurityPasswordForm from './security-password-form';
import SecuritySessions from './security-sessions';
import en from '@/messages/en';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  changePassword: vi.fn(),
  changeMail: vi.fn(),
  deleteSession: vi.fn(),
  deleteAllSessions: vi.fn(),
  disableTfa: vi.fn(),
  enableTfa: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Account: {
      changePassword: mocks.changePassword,
      changeMail: mocks.changeMail,
      deleteSession: mocks.deleteSession,
      deleteAllSessions: mocks.deleteAllSessions,
      disableTfa: mocks.disableTfa,
      enableTfa: mocks.enableTfa,
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }),
  usePathname: () => '/home/settings/security',
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/shared/hooks/use-clipboard-copy', () => ({
  useClipboardCopy: () => ({ copied: false, onCopy: vi.fn() }),
}));

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

const success = () => ({
  send: vi.fn().mockResolvedValue({ url: '/home/security' }),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.changePassword.mockImplementation(success);
  mocks.changeMail.mockImplementation(success);
  mocks.deleteSession.mockImplementation(success);
  mocks.deleteAllSessions.mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({ url: '/login' }),
  }));
  mocks.disableTfa.mockImplementation(success);
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('password form', () => {
  it('requires matching new passwords before contacting the backend', async () => {
    render(wrap(<SecurityPasswordForm />));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current password'), 'old-secret');
    await user.type(screen.getByLabelText('New password'), 'new-secret');
    await user.type(screen.getByLabelText('Repeat new password'), 'different');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    expect(
      await screen.findByText('The passwords do not match.')
    ).toBeInTheDocument();
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it('submits the three values and returns to sign-in after the sessions are revoked', async () => {
    render(wrap(<SecurityPasswordForm />));
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Current password'), 'old-secret');
    await user.type(screen.getByLabelText('New password'), 'new-secret');
    await user.type(screen.getByLabelText('Repeat new password'), 'new-secret');
    await user.click(screen.getByRole('button', { name: 'Change password' }));
    await waitFor(() =>
      expect(mocks.changePassword).toHaveBeenCalledWith(
        'old-secret',
        'new-secret',
        'new-secret'
      )
    );
    expect(mocks.success).toHaveBeenCalledWith(
      'Password changed. Sign in again with your new password.'
    );
    expect(mocks.push).toHaveBeenCalledWith('/login');
  });
});

describe('email form', () => {
  it('shows the confirmation state and the address it was sent to', async () => {
    render(wrap(<SecurityMailForm currentMail="old@example.test" />));
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('New email address'),
      'new@example.test'
    );
    await user.type(screen.getByLabelText('Current password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Send confirmation' }));
    expect(
      await screen.findByText(
        'Open the link we sent to new@example.test to finish the change.'
      )
    ).toBeInTheDocument();
    expect(mocks.changeMail).toHaveBeenCalledWith('secret', 'new@example.test');
    // The form is replaced by the sent state.
    expect(
      screen.queryByRole('button', { name: 'Send confirmation' })
    ).not.toBeInTheDocument();
  });

  it('rejects the current address without contacting the backend', async () => {
    render(wrap(<SecurityMailForm currentMail="old@example.test" />));
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('New email address'),
      'old@example.test'
    );
    await user.type(screen.getByLabelText('Current password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Send confirmation' }));
    expect(
      await screen.findByText('Enter a different email address.')
    ).toBeInTheDocument();
    expect(mocks.changeMail).not.toHaveBeenCalled();
  });

  it('can start another confirmation after sending', async () => {
    render(wrap(<SecurityMailForm currentMail="old@example.test" />));
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('New email address'),
      'new@example.test'
    );
    await user.type(screen.getByLabelText('Current password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Send confirmation' }));
    await user.click(
      await screen.findByRole('button', { name: 'Send to another address' })
    );
    expect(
      screen.getByRole('button', { name: 'Send confirmation' })
    ).toBeInTheDocument();
  });
});

describe('sessions list', () => {
  const sessions = [
    {
      _id: 'current-digest',
      isCurrent: true,
      updateIp: '203.0.113.8',
      updateAt: '2026-06-01T00:00:00.000Z',
      updateUaInfo: { browser: { name: 'Firefox', version: '128' } },
    },
    {
      _id: 'other-digest',
      updateIp: '198.51.100.1',
      updateAt: '2026-05-01T00:00:00.000Z',
      updateUaInfo: { browser: { name: 'Safari', version: '17' } },
    },
  ];

  it('marks the current session and only offers sign-out on the others', () => {
    render(wrap(<SecuritySessions sessions={sessions} />));
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('This session')).toBeInTheDocument();
    expect(
      within(items[0]).queryByRole('button', { name: 'Sign out' })
    ).not.toBeInTheDocument();
    expect(within(items[1]).getByText('Safari 17')).toBeInTheDocument();
    expect(
      within(items[1]).getByRole('button', { name: 'Sign out' })
    ).toBeInTheDocument();
  });

  it('signs out a single other session by its digest', async () => {
    render(wrap(<SecuritySessions sessions={sessions} />));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() =>
      expect(mocks.deleteSession).toHaveBeenCalledWith('other-digest')
    );
    expect(mocks.success).toHaveBeenCalledWith('Session signed out.');
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('signs out every session and leaves for the returned page', async () => {
    render(wrap(<SecuritySessions sessions={sessions} />));
    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: 'Sign out all sessions' })
    );
    const dialog = await screen.findByRole('alertdialog');
    await user.click(
      within(dialog).getByRole('button', { name: 'Sign out all sessions' })
    );
    await waitFor(() => expect(mocks.deleteAllSessions).toHaveBeenCalled());
    expect(mocks.push).toHaveBeenCalledWith('/login');
  });

  it('shows a clear empty state when there are no sessions', () => {
    render(wrap(<SecuritySessions sessions={[]} />));
    expect(
      screen.getByText('There are no active sessions to show.')
    ).toBeInTheDocument();
  });
});

describe('authenticators', () => {
  it('lists the authentication app state and removes it only after confirmation', async () => {
    render(
      wrap(
        <SecurityAuthenticators uname="alice" tfaEnabled authenticators={[]} />
      )
    );
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(
        'Sign-in will no longer ask for a code from your authentication app.'
      )
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(mocks.disableTfa).toHaveBeenCalled());
    expect(mocks.success).toHaveBeenCalledWith('Authentication app removed.');
  });

  it('shows the registered security keys with their names', () => {
    render(
      wrap(
        <SecurityAuthenticators
          uname="alice"
          tfaEnabled={false}
          authenticators={[
            {
              credentialID: { base64: 'ABCDEFGHIJ' },
              name: 'Laptop key',
              credentialDeviceType: 'singleDevice',
              authenticatorAttachment: 'platform',
              regat: Date.UTC(2026, 0, 2),
            },
          ]}
        />
      )
    );
    expect(screen.getByText('Laptop key')).toBeInTheDocument();
    expect(screen.getByText('ABCDEF')).toBeInTheDocument();
    expect(
      screen.queryByText('No security keys are registered yet.')
    ).not.toBeInTheDocument();
  });

  it('opens the add-authenticator chooser with the authentication app option', async () => {
    render(
      wrap(
        <SecurityAuthenticators
          uname="alice"
          tfaEnabled={false}
          authenticators={[]}
        />
      )
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Add authenticator' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: /Authentication app/ })
    ).toBeEnabled();
  });
});
