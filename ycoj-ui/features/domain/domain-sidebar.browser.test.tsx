import DomainSidebar from './domain-sidebar';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/domain/user',
}));

describe('domain management sidebar', () => {
  it('lists every admin destination and marks the current one', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <DomainSidebar />
      </NextIntlClientProvider>
    );
    const nav = screen.getByRole('navigation', { name: 'Domain management' });
    expect(nav).toBeInTheDocument();
    for (const [label, href] of [
      ['Console', '/domain'],
      ['Settings', '/domain/edit'],
      ['Roles', '/domain/role'],
      ['Members', '/domain/user'],
      ['Permissions', '/domain/permission'],
      ['Groups', '/domain/group'],
    ] as const) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href
      );
    }
    expect(screen.getByRole('link', { name: 'Members' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: 'Roles' })).not.toHaveAttribute(
      'aria-current'
    );
  });
});
