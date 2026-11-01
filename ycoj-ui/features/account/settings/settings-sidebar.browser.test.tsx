import SettingsSidebar, { isSettingsCategoryActive } from './settings-sidebar';
import en from '@/messages/en';
import { render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ pathname: '/home/settings/account' }));
vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
}));

function page() {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      <SettingsSidebar />
    </NextIntlClientProvider>
  );
}

afterEach(() => {
  mocks.pathname = '/home/settings/account';
});

describe('isSettingsCategoryActive', () => {
  it.each([
    ['/home/settings/account', '/home/settings/account', true],
    ['/home/settings/security/deleted', '/home/settings/security', true],
    ['/home/settings/domain', '/home/settings/domain', true],
    ['/home/settings/account', '/home/settings/security', false],
    ['/home/settings', '/home/settings/account', false],
  ])('%s vs %s → %s', (pathname, href, expected) => {
    expect(isSettingsCategoryActive(pathname, href)).toBe(expected);
  });
});

describe('settings sidebar', () => {
  it('links every settings category', () => {
    render(page());
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Account settings',
      'Security',
      'Preferences',
      'Domain settings',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/home/settings/account',
      '/home/settings/security',
      '/home/settings/preference',
      '/home/settings/domain',
    ]);
  });

  it('highlights only the active category', () => {
    mocks.pathname = '/home/settings/security';
    render(page());
    const nav = screen.getByRole('navigation', { name: 'Settings' });
    const current = within(nav)
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName('Security');
  });

  it('keeps the security entry active on its nested result page', () => {
    mocks.pathname = '/home/settings/security/deleted';
    render(page());
    expect(screen.getByRole('link', { name: 'Security' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
