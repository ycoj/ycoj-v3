import '@/app/globals.css';
import ScriptRunner from './script-runner';
import messages from '@/messages/en';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  send: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/api/client/method/system/script', () => ({
  runSystemScript: mocks.run,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

function renderRunner(
  scripts = [
    { id: 'rebuild', description: 'Rebuild problem statistics' },
    { id: 'checkUpdate', description: undefined },
  ]
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ScriptRunner scripts={scripts} />
    </NextIntlClientProvider>
  );
}

describe('Admin script runner', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.run.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({
      rid: '66aa66aa66aa66aa66aa66aa',
      url: '/record/66aa66aa66aa66aa66aa66aa',
    });
  });

  it('lists the registered scripts with descriptions', () => {
    renderRunner();
    expect(screen.getByText('rebuild')).toBeInTheDocument();
    expect(screen.getByText('Rebuild problem statistics')).toBeInTheDocument();
    expect(screen.getByText('checkUpdate')).toBeInTheDocument();
  });

  it('runs a script with JSON arguments and opens its record', async () => {
    renderRunner();
    await userEvent.click(screen.getByRole('button', { name: 'Run rebuild' }));
    const dialog = await screen.findByRole('dialog');
    const args = within(dialog).getByLabelText('Arguments (JSON)');
    fireEvent.change(args, { target: { value: '{"force":true}' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run' }));
    await waitFor(() =>
      expect(mocks.run).toHaveBeenCalledWith('rebuild', '{"force":true}')
    );
    expect(mocks.push).toHaveBeenCalledWith('/record/66aa66aa66aa66aa66aa66aa');
  });

  it('rejects arguments that are not a JSON object', async () => {
    renderRunner();
    await userEvent.click(screen.getByRole('button', { name: 'Run rebuild' }));
    const dialog = await screen.findByRole('dialog');
    const args = within(dialog).getByLabelText('Arguments (JSON)');
    fireEvent.change(args, { target: { value: '[1,2]' } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Run' }));
    expect(
      await within(dialog).findByText('Enter a valid JSON object.')
    ).toBeVisible();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it('shows an empty state when no scripts are registered', () => {
    renderRunner([]);
    expect(
      screen.getByText('No scripts are registered on this server.')
    ).toBeInTheDocument();
  });
});
