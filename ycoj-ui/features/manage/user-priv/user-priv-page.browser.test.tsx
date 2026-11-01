import '@/app/globals.css';
import type { UserPrivPageData } from './get-user-priv-page';
import UserPrivPage from './user-priv-page';
import messages from '@/messages/en';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  detail: vi.fn(),
  send: vi.fn(),
  detailSend: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@/api/client/method/system/user-priv', () => ({
  updateUserPrivilege: mocks.update,
  getUserPrivDetail: mocks.detail,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));
const data: UserPrivPageData = {
  defaultPriv: 4,
  priv: {
    PRIV_EDIT_SYSTEM: 1,
    PRIV_USER_PROFILE: 4,
    PRIV_JUDGE: 512,
  },
  accounts: [
    { _id: 12, uname: 'alice', priv: 513 },
    { _id: 13, uname: 'bob', priv: 4 },
  ],
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <UserPrivPage data={data} />
    </NextIntlClientProvider>
  );
}

describe('User privilege editor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.update.mockReturnValue({ send: mocks.send });
    mocks.detail.mockReturnValue({ send: mocks.detailSend });
    mocks.send.mockResolvedValue({ url: '/manage/userpriv' });
  });

  it('shows each account with its privilege delta', () => {
    renderPage();
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('+PRIV_EDIT_SYSTEM')).toBeInTheDocument();
    expect(screen.getByText('+PRIV_JUDGE')).toBeInTheDocument();
  });

  it('toggles bits for one account and submits the new mask', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Edit alice' }));
    const dialog = await screen.findByRole('dialog');
    const editSystem = within(dialog).getByRole('checkbox', {
      name: 'PRIV_EDIT_SYSTEM',
    });
    expect(editSystem).toBeChecked();
    await userEvent.click(editSystem);
    expect(editSystem).not.toBeChecked();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Apply' })
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({ uid: 12, priv: 512 })
    );
    expect(mocks.success).toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('saves the server default as a system-wide update', async () => {
    renderPage();
    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('checkbox', { name: 'PRIV_JUDGE' })
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Apply' })
    );
    await waitFor(() =>
      expect(mocks.update).toHaveBeenCalledWith({
        uid: 0,
        priv: 516,
        system: true,
      })
    );
  });

  it('opens an account by username from the search field', async () => {
    mocks.detailSend.mockResolvedValue({
      udoc: { _id: 13, uname: 'bob', priv: 516 },
    });
    renderPage();
    const search = screen.getByLabelText('Find a user');
    await userEvent.type(search, 'bob');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(mocks.detail).toHaveBeenCalledWith('bob');
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('checkbox', { name: 'PRIV_JUDGE' })
    ).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: 'PRIV_USER_PROFILE' })
    ).toBeChecked();
    expect(
      within(dialog).getByRole('checkbox', { name: 'PRIV_EDIT_SYSTEM' })
    ).not.toBeChecked();
  });

  it('refuses to edit super administrators and surfaces backend errors', async () => {
    mocks.send.mockResolvedValue({
      error: { message: 'You are not allowed to edit super admin in web.' },
    });
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Edit bob' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Apply' })
    );
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You are not allowed to edit super admin in web.'
    );
  });
});
