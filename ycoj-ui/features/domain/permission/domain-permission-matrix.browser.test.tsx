import '@/app/globals.css';
import DomainPermissionMatrix from './domain-permission-matrix';
import type { DomainPermissionsResponse } from '@/api/server/method/domain/types';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: { Domain: { saveDomainPermissions: mocks.save } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

function fixture(): DomainPermissionsResponse {
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
      { _id: 'default', perm: 'BigInt::1' },
      { _id: 'teacher', perm: 'BigInt::0' },
    ],
    PERMS_BY_FAMILY: {
      perm_general: [
        { family: 'perm_general', key: 'BigInt::1', desc: 'View this domain' },
        {
          family: 'perm_general',
          key: 'BigInt::2',
          desc: 'Edit domain settings',
        },
      ],
    },
  };
}

function mount(data = fixture()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DomainPermissionMatrix data={data} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.save.mockReturnValue({
    send: () => Promise.resolve({ url: '/domain/permission' }),
  });
});

describe('domain permission matrix', () => {
  it('renders the root column read-only and other roles editable', () => {
    mount();
    expect(
      screen.getByRole('checkbox', {
        name: 'root: View this domain',
      })
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', { name: 'default: View this domain' })
    ).toBeEnabled();
    expect(
      screen.getByRole('checkbox', { name: 'teacher: View this domain' })
    ).toBeEnabled();
  });

  it('persists the toggled bit without touching the root role', async () => {
    mount();
    const edit = screen.getByRole('checkbox', {
      name: 'teacher: Edit domain settings',
    });
    await userEvent.click(edit);
    await userEvent.click(
      screen.getByRole('button', { name: 'Update permissions' })
    );
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledExactlyOnceWith({
        default: [BigInt(0)],
        teacher: [BigInt(1)],
      })
    );
  });

  it('keeps the submit button disabled until a permission changes', async () => {
    mount();
    const submit = screen.getByRole('button', { name: 'Update permissions' });
    expect(submit).toBeDisabled();
    await userEvent.click(
      screen.getByRole('checkbox', { name: 'default: Edit domain settings' })
    );
    expect(submit).toBeEnabled();
  });
});
