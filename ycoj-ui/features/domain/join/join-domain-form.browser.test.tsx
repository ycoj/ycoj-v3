import '@/app/globals.css';
import JoinDomainForm from './join-domain-form';
import type { DomainJoinResponse } from '@/api/server/method/domain/types';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  join: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: { Domain: { joinDomain: mocks.join } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

const owner = {
  _id: 2,
  uname: 'owner',
  mail: 'owner@example.test',
  avatar: '',
};

function fixture(
  overrides: Partial<DomainJoinResponse> = {}
): DomainJoinResponse {
  return {
    code: '',
    redirect: '',
    target: 'school',
    joinSettings: { method: 1, role: 'default' },
    domainInfo: { name: 'School', owner, bulletin: 'Welcome' },
    ...overrides,
  };
}

function mount(data = fixture()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <JoinDomainForm
        data={data}
        target="school"
        activeDomainId="system"
        bulletin={<div>Welcome</div>}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.join.mockReturnValue({
    send: () => Promise.resolve({ url: '/d/system/home?notification=joined' }),
  });
});

describe('join domain flow', () => {
  it('joins an open domain and navigates to the returned destination', async () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Join School' })).toBeVisible();
    expect(screen.getByText('owner')).toBeVisible();
    expect(screen.getByText('Welcome')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledExactlyOnceWith({ target: 'school' })
    );
    // `/d/system/home` maps to the active domain, so the app route is `/home`.
    expect(mocks.push).toHaveBeenCalledWith('/home');
  });

  it('requires the invitation code before submitting', async () => {
    mount(fixture({ joinSettings: { method: 2, role: 'default' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(mocks.join).not.toHaveBeenCalled();
    expect(screen.getByText('Enter the invitation code.')).toBeVisible();

    await userEvent.type(screen.getByLabelText('Invitation code'), 'invite');
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() =>
      expect(mocks.join).toHaveBeenCalledExactlyOnceWith({
        target: 'school',
        code: 'invite',
      })
    );
  });

  it('reports an already-member failure instead of navigating', async () => {
    mocks.join.mockReturnValue({
      send: () =>
        Promise.resolve({ error: { name: 'DomainJoinAlreadyMemberError' } }),
    });
    mount();
    await userEvent.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'You are already a member of this domain.'
      )
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
