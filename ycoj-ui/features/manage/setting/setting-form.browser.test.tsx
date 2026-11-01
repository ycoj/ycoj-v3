import '@/app/globals.css';
import SettingForm from './setting-form';
import type { SystemSettingsResponse } from '@/api/server/method/system/setting';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/api/client/method/system/setting', () => ({
  saveSystemSettings: mocks.save,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const data: SystemSettingsResponse = {
  current: {
    'server.name': 'Hydro',
    'smtp.pass': 'stored-secret',
    'smtp.secure': true,
    'server.port': 8888,
  },
  settings: [
    {
      family: 'setting_server',
      key: 'server.name',
      name: 'Server Name',
      desc: 'Shown in the site header',
      value: 'Hydro',
      flag: 0,
      type: 'text',
    },
    {
      family: 'setting_server',
      key: 'server.port',
      name: 'Server Port',
      desc: null,
      value: 8888,
      flag: 0,
      type: 'number',
    },
    {
      family: 'setting_smtp',
      key: 'smtp.pass',
      name: 'SMTP Password',
      desc: null,
      value: '',
      flag: 4,
      type: 'password',
    },
    {
      family: 'setting_smtp',
      key: 'smtp.secure',
      name: 'SSL',
      desc: null,
      value: false,
      flag: 0,
      type: 'boolean',
    },
  ],
};

function renderForm(value: SystemSettingsResponse = data) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SettingForm data={value} />
    </NextIntlClientProvider>
  );
}

describe('System settings form', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.save.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ url: '/manage/setting' });
  });

  it('renders stored values without exposing secrets', () => {
    renderForm();
    expect(screen.getByLabelText(/Server Name/)).toHaveValue('Hydro');
    expect(screen.getByLabelText(/SMTP Password/)).toHaveValue('');
    expect(screen.queryByDisplayValue('stored-secret')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'SSL' })).toBeChecked();
  });

  it('saves edited values and keeps blank secrets unchanged', async () => {
    renderForm();
    await userEvent.clear(screen.getByLabelText(/Server Name/));
    await userEvent.type(screen.getByLabelText(/Server Name/), 'YCOJ');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        {
          server: { name: 'YCOJ', port: '8888' },
          smtp: { secure: 'on' },
        },
        { smtp: { secure: true } }
      )
    );
    expect(mocks.success).toHaveBeenCalled();
  });

  it('blocks invalid numbers before calling the server', async () => {
    renderForm();
    const port = screen.getByLabelText(/Server Port/);
    await userEvent.clear(port);
    await userEvent.type(port, 'eighty');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Enter a valid number.')).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('shows backend failures without leaving the form', async () => {
    mocks.send.mockResolvedValue({ error: { message: 'Invalid setting' } });
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Invalid setting')).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
