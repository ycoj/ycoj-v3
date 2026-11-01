import '@/app/globals.css';
import DomainMembersPage from './domain-members-page';
import type { DomainUsersResponse } from '@/api/server/method/domain/types';
import messages from '@/messages/en';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setUsers: vi.fn(),
  kick: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Domain: {
      setDomainUsers: mocks.setUsers,
      kickDomainUsers: mocks.kick,
      updateDomainGroup: vi.fn(),
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
  usePathname: () => '/domain/user',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/user/user-auto-complete', () => ({
  default: ({ ariaLabel }: { ariaLabel: string }) => (
    <input aria-label={ariaLabel} />
  ),
}));

function fixture(): DomainUsersResponse {
  return {
    domain: {
      _id: 'school',
      owner: 2,
      roles: {},
      avatar: '',
      bulletin: '',
      name: 'School',
    },
    roles: [
      { _id: 'root', perm: 'BigInt::-1' },
      { _id: 'default', perm: 'BigInt::5' },
      { _id: 'teacher', perm: 'BigInt::256' },
    ],
    rudocs: {
      root: [
        {
          _id: 2,
          uname: 'owner',
          role: 'root',
          join: true,
          mail: 'o@example.test',
          avatar: '',
        },
      ],
      default: [
        {
          _id: 3,
          uname: 'alice',
          role: 'default',
          join: true,
          mail: 'a@example.test',
          avatar: '',
        },
        {
          _id: 4,
          uname: 'bob',
          role: 'default',
          join: false,
          mail: 'b@example.test',
          avatar: '',
        },
      ],
    },
  };
}

function mount(data = fixture()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DomainMembersPage
        data={data}
        domainId="school"
        ownerId={2}
        viewerId={2}
        canForceJoin
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setUsers.mockReturnValue({
    send: () => Promise.resolve({ url: '/domain/user' }),
  });
  mocks.kick.mockReturnValue({
    send: () => Promise.resolve({ url: '/domain/user' }),
  });
});

describe('domain member management', () => {
  it('assigns a role to selected members in one batch request', async () => {
    mount();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Username alice' })
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Username bob' })
    );
    expect(screen.getByText('2 selected')).toBeVisible();

    await userEvent.click(
      screen.getByRole('button', { name: /Set role for selected/i })
    );
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Save changes' })
    );

    // The dialog preselects the first assignable role; both members are
    // updated in a single request.
    await waitFor(() =>
      expect(mocks.setUsers).toHaveBeenCalledExactlyOnceWith(
        [3, 4],
        'root',
        false
      )
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });

  it('changes a single member role from the row picker', async () => {
    mount();
    await userEvent.click(screen.getByRole('combobox', { name: 'Role alice' }));
    await userEvent.click(
      await screen.findByRole('option', { name: 'teacher' })
    );
    await waitFor(() =>
      expect(mocks.setUsers).toHaveBeenCalledExactlyOnceWith(
        [3],
        'teacher',
        false
      )
    );
  });

  it('does not let the owner be selected', () => {
    mount();
    expect(
      screen.getByRole('checkbox', { name: 'Username owner' })
    ).toBeDisabled();
  });

  it('removes selected members through the kick operation', async () => {
    mount();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'Username alice' })
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Remove selected/i })
    );
    await userEvent.click(
      await screen.findByRole('button', { name: 'Remove selected' })
    );
    await waitFor(() =>
      expect(mocks.kick).toHaveBeenCalledExactlyOnceWith([3])
    );
  });
});
