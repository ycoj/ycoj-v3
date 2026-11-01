import '@/app/globals.css';
import DomainSettingsPage from './domain-settings-page';
import PreferenceSettingsPage from './preference-settings-page';
import en from '@/messages/en';
import {
  SETTING_FLAG,
  type AccountSetting,
} from '@/shared/types/account-settings';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock('@/api/client/method', () => ({
  default: {
    Account: {
      saveUserSettings: mocks.save,
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  usePathname: () => '/home/settings/preference',
}));

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

const setting = (
  key: string,
  overrides: Partial<AccountSetting> = {}
): AccountSetting => ({
  key,
  name: key,
  family: 'setting_display',
  type: 'text',
  value: '',
  flag: 0,
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('preference settings', () => {
  it('renders fields returned by the backend instead of a hardcoded list', () => {
    render(
      wrap(
        <PreferenceSettingsPage
          data={{
            category: 'preference',
            current: {
              _id: 2,
              uname: 'alice',
              mail: 'alice@example.test',
              avatar: '',
            },
            settings: [
              setting('timeZone', {
                type: 'select',
                value: 'Asia/Shanghai',
                range: [
                  ['Asia/Shanghai', 'Asia/Shanghai'],
                  ['UTC', 'UTC'],
                ],
              }),
              setting('plugin.accent', {
                name: 'Plugin accent',
                family: 'Plugin',
                type: 'text',
              }),
            ],
          }}
        />
      )
    );
    expect(
      screen.getByRole('heading', { name: 'Preferences' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Time zone')).toBeInTheDocument();
    expect(screen.getByLabelText('Plugin accent')).toBeInTheDocument();
  });

  it('prefers built-in translations for known keys, including family headings', () => {
    render(
      wrap(
        <PreferenceSettingsPage
          data={{
            category: 'preference',
            current: {
              _id: 2,
              uname: 'alice',
              mail: 'alice@example.test',
              avatar: '',
            },
            settings: [
              setting('codeLang', {
                family: 'setting_usage',
                type: 'select',
                range: [['cc.cc14o2', 'C++14']],
              }),
            ],
          }}
        />
      )
    );
    expect(
      screen.getByRole('region', { name: 'Code defaults' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Default code language')).toBeInTheDocument();
  });

  it('shows an empty state when the server has no preference settings', () => {
    render(
      wrap(
        <PreferenceSettingsPage
          data={{
            category: 'preference',
            current: {
              _id: 2,
              uname: 'alice',
              mail: 'alice@example.test',
              avatar: '',
            },
            settings: [setting('hidden', { flag: SETTING_FLAG.HIDDEN })],
          }}
        />
      )
    );
    expect(
      screen.getByText('No preferences are available')
    ).toBeInTheDocument();
  });
});

describe('domain settings', () => {
  it('renders personal domain settings and labels the page as domain-scoped', () => {
    render(
      wrap(
        <DomainSettingsPage
          data={{
            category: 'domain',
            current: {
              _id: 2,
              uname: 'alice',
              mail: 'alice@example.test',
              avatar: '',
            },
            settings: [
              setting('displayName', {
                family: 'setting_info',
                value: 'Alice',
              }),
            ],
          }}
        />
      )
    );
    expect(
      screen.getByRole('heading', { name: 'Domain settings' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Display name')).toHaveValue('Alice');
  });

  it('keeps internal storage settings out of the form', () => {
    render(
      wrap(
        <DomainSettingsPage
          data={{
            category: 'domain',
            current: {
              _id: 2,
              uname: 'alice',
              mail: 'alice@example.test',
              avatar: '',
            },
            settings: [
              setting('displayName', { family: 'setting_info' }),
              setting('rp', { family: 'setting_storage', type: 'number' }),
            ],
          }}
        />
      )
    );
    expect(screen.getByLabelText('Display name')).toBeInTheDocument();
    expect(screen.queryByLabelText('rp')).not.toBeInTheDocument();
  });
});
