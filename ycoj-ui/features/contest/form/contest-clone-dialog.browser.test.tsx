import ContestCloneDialog from './contest-clone-dialog';
import type { ContestCloneValues } from '@/features/contest/form/contest-form-utils';
import messages from '@/messages/en';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prefilled: ContestCloneValues = {
  title: 'Weekly contest',
  beginAtDate: '2026-09-01',
  beginAtTime: '10:00',
  duration: '3',
  autoHide: true,
};

function renderDialog(
  defaultValues: ContestCloneValues = prefilled,
  onConfirm = vi.fn().mockResolvedValue(undefined),
  canAutoHide = true
) {
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContestCloneDialog
        defaultValues={defaultValues}
        canAutoHide={canAutoHide}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>
  );
  return { onConfirm, onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('contest clone dialog', () => {
  it('prefills the clone settings and previews the end time', () => {
    renderDialog();
    expect(
      screen.getByRole('dialog', { name: 'Clone contest' })
    ).toHaveAccessibleDescription(messages.contestEdit.cloneDescription);
    expect(screen.getByLabelText('Title')).toHaveValue('Weekly contest');
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-09-01');
    expect(screen.getByLabelText('Start time')).toHaveValue('10:00');
    expect(screen.getByLabelText('Duration (hours)')).toHaveValue(3);
    expect(screen.getByLabelText('End time')).toHaveValue('2026-09-01 13:00');
    expect(
      screen.getByRole('checkbox', { name: /Auto-hide problems/ })
    ).toBeChecked();
  });

  it('updates the end time preview while editing', async () => {
    renderDialog();
    fireEvent.change(screen.getByLabelText('Duration (hours)'), {
      target: { value: '1.5' },
    });
    expect(screen.getByLabelText('End time')).toHaveValue('2026-09-01 11:30');
  });

  it('blocks confirmation while the settings are invalid', async () => {
    const { onConfirm } = renderDialog({ ...prefilled, title: '   ' });
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.contestEdit.titleRequired
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the edited settings', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderDialog(undefined, onConfirm);
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Night contest' },
    });
    fireEvent.change(screen.getByLabelText('Start time'), {
      target: { value: '20:30' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Night contest',
      beginAtDate: '2026-09-01',
      beginAtTime: '20:30',
      duration: '3',
      autoHide: true,
    });
  });

  it('clones with auto-hide turned off when it is unchecked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderDialog(undefined, onConfirm);
    await userEvent.click(
      screen.getByRole('checkbox', { name: /Auto-hide problems/ })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Weekly contest',
      beginAtDate: '2026-09-01',
      beginAtTime: '10:00',
      duration: '3',
      autoHide: false,
    });
  });

  it('clones with auto-hide turned on when it is unchecked in the source', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderDialog({ ...prefilled, autoHide: false }, onConfirm);
    await userEvent.click(
      screen.getByRole('checkbox', { name: /Auto-hide problems/ })
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Weekly contest',
      beginAtDate: '2026-09-01',
      beginAtTime: '10:00',
      duration: '3',
      autoHide: true,
    });
  });

  it('locks auto-hide off when the user lacks the permission', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    renderDialog(undefined, onConfirm, false);
    const autoHide = screen.getByRole('checkbox', {
      name: /Auto-hide problems/,
    });
    expect(autoHide).toBeDisabled();
    expect(autoHide).not.toBeChecked();
    expect(
      screen.getByText(messages.contestEdit.autoHideUnavailable)
    ).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith({
      title: 'Weekly contest',
      beginAtDate: '2026-09-01',
      beginAtTime: '10:00',
      duration: '3',
      autoHide: false,
    });
  });

  it('does not submit an outer form when confirming the clone', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOuterSubmit = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <form onSubmit={onOuterSubmit}>
          <ContestCloneDialog
            defaultValues={prefilled}
            canAutoHide
            onClose={vi.fn()}
            onConfirm={onConfirm}
          />
        </form>
      </NextIntlClientProvider>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(prefilled);
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it('shows clone failures inside the dialog and stays open', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Permission denied'));
    renderDialog(undefined, onConfirm);
    await userEvent.click(screen.getByRole('button', { name: 'Clone' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied'
    );
    expect(screen.getByRole('dialog', { name: 'Clone contest' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clone' })).toBeEnabled();
  });

  it('cancels without confirming', async () => {
    const { onConfirm, onClose } = renderDialog();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledExactlyOnceWith();
  });
});
