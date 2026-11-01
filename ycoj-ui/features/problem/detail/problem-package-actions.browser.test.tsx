import ProblemPackageActions from './problem-package-actions';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/features/problem/package/download-problem-packages', () => ({
  downloadProblemPackages: mocks.download,
}));

vi.mock('sonner', () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

vi.mock('@/features/problem/copy/copy-problems-dialog', () => ({
  default: ({
    pids,
    trigger,
  }: {
    pids: number[];
    trigger: React.ReactNode;
  }) => (
    <div data-testid="copy-dialog" data-pids={pids.join(',')}>
      {trigger}
    </div>
  ),
}));

function renderActions(
  props: {
    allowDownload?: boolean;
    allowCopy?: boolean;
  } = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemPackageActions
        docId={1000}
        domainId="system"
        allowDownload={props.allowDownload ?? true}
        allowCopy={props.allowCopy ?? true}
      />
    </NextIntlClientProvider>
  );
}

describe('ProblemPackageActions', () => {
  beforeEach(() => {
    mocks.download.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('downloads the current problem package', async () => {
    renderActions();
    await userEvent.click(
      screen.getByRole('button', { name: 'Download package' })
    );
    await waitFor(() =>
      expect(mocks.download).toHaveBeenCalledWith([1000], 'system')
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'The problem package is ready.'
    );
  });

  it('reports a failed package build', async () => {
    mocks.download.mockRejectedValueOnce(new Error('No readable problems'));
    renderActions();
    await userEvent.click(
      screen.getByRole('button', { name: 'Download package' })
    );
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('No readable problems')
    );
  });

  it('opens the copy dialog for this problem only', () => {
    renderActions();
    expect(screen.getByTestId('copy-dialog')).toHaveAttribute(
      'data-pids',
      '1000'
    );
    expect(
      screen.getByRole('button', { name: 'Copy to another domain' })
    ).toBeVisible();
  });

  it('hides actions the user cannot use', () => {
    renderActions({ allowDownload: false, allowCopy: false });
    expect(
      screen.queryByRole('button', { name: 'Download package' })
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('copy-dialog')).not.toBeInTheDocument();
  });
});
