import CopyProblemsDialog from './copy-problems-dialog';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  search: vi.fn(),
  toastSuccess: vi.fn(),
  onCopied: vi.fn(),
}));

vi.mock('@/api/client/method/problem/copy', () => ({
  copyProblems: (pids: number[], target: string, options: unknown) => ({
    send: () => mocks.copy(pids, target, options),
  }),
  searchCopyTargetDomains: (query: string) => mocks.search(query),
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: vi.fn() },
}));

const domains = [
  { _id: 'school', name: 'School' },
  { _id: 'legacy', name: 'Legacy' },
];

// The dialog overlay makes the portal outside it pointer-events: none in
// jsdom-style hit testing; the user still interacts with the true target.
const user = userEvent.setup({ pointerEventsCheck: 0 });

function renderDialog(pids = [1000, 1001]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <CopyProblemsDialog
        pids={pids}
        onCopied={mocks.onCopied}
        trigger={<button type="button">Copy to domain</button>}
      />
    </NextIntlClientProvider>
  );
}

describe('CopyProblemsDialog', () => {
  beforeEach(() => {
    mocks.search.mockResolvedValue(domains);
    mocks.copy.mockResolvedValue([1, 2]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('describes how many problems will be copied', async () => {
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Copy to domain' }));
    expect(
      screen.getByText('Copy 2 problems to another domain.')
    ).toBeVisible();
  });

  it('requires a target domain', async () => {
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Copy to domain' }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Choose a target domain.'
    );
    expect(mocks.copy).not.toHaveBeenCalled();
  });

  it('copies to a searched target with the hidden option', async () => {
    renderDialog();
    await user.click(screen.getByRole('button', { name: 'Copy to domain' }));

    await user.type(
      screen.getByRole('combobox', { name: 'Target domain' }),
      'school'
    );
    await user.click(await screen.findByRole('option', { name: /School/ }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Create as hidden' })
    );
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() =>
      expect(mocks.copy).toHaveBeenCalledWith([1000, 1001], 'school', {
        hidden: true,
      })
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith('2 problems copied');
    expect(mocks.onCopied).toHaveBeenCalledTimes(1);
  });

  it('shows the backend error and stays open', async () => {
    mocks.copy.mockResolvedValueOnce({
      error: { name: 'PermissionError', message: 'Permission denied' },
    });
    renderDialog([1000]);
    await user.click(screen.getByRole('button', { name: 'Copy to domain' }));
    await user.type(
      screen.getByRole('combobox', { name: 'Target domain' }),
      'legacy'
    );
    await user.click(await screen.findByRole('option', { name: /Legacy/ }));
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied'
    );
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(mocks.onCopied).not.toHaveBeenCalled();
  });
});
