import RegisterRequestForm from './register-request-form';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  send: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock('@/api/client/method/auth/register', () => ({
  startRegistration: mocks.register,
}));
vi.mock('@/features/auth/navigate', () => ({ hardNavigate: mocks.navigate }));

function show() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RegisterRequestForm />
    </NextIntlClientProvider>
  );
}

describe('RegisterRequestForm', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.register.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({});
  });

  it('confirms that the sign-up link was sent', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send sign-up link' })
    );

    expect(
      await screen.findByText(
        'We sent a sign-up link to alice@example.test. Open it to finish creating your account.'
      )
    ).toBeInTheDocument();
  });

  it('explains when registration is not open', async () => {
    mocks.send.mockResolvedValue({
      error: {
        name: 'PrivilegeError',
        message: "You don't have the required privilege.",
      },
    });
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send sign-up link' })
    );

    expect(
      await screen.findByText(
        'This site is not accepting new accounts right now.'
      )
    ).toBeInTheDocument();
  });

  it('explains that the email is already registered', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'UserAlreadyExistError', params: ['alice@example.test'] },
    });
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send sign-up link' })
    );

    expect(
      await screen.findByText('An account already exists for this email.')
    ).toBeInTheDocument();
  });

  it('validates the email before sending', async () => {
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send sign-up link' })
    );

    expect(
      await screen.findByText('Enter a valid email address.')
    ).toBeInTheDocument();
    expect(mocks.register).not.toHaveBeenCalled();
  });

  it('follows the backend when it sends the user straight to the form', async () => {
    mocks.send.mockResolvedValue({ url: '/register/token-2' });
    show();
    await userEvent.type(screen.getByLabelText('Email'), 'alice@example.test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Send sign-up link' })
    );

    expect(mocks.navigate).toHaveBeenCalledWith('/home');
  });
});
