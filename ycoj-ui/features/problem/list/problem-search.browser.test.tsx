import '@/app/globals.css';
import ProblemSearch from './problem-search';
import messages from '@/messages/en';
import zhMessages from '@/messages/zh';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    className,
    title,
    'aria-label': label,
  }: ComponentProps<'a'>) => (
    <a href={href} className={className} title={title} aria-label={label}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

function mount(count?: number, canReview = true, locale = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'zh' ? zhMessages : messages}
    >
      <div className="p-4">
        <ProblemSearch
          canCreate
          canReview={canReview}
          canManageFeedback
          pendingSolutionCount={count}
        />
      </div>
    </NextIntlClientProvider>
  );
}

describe('problem list solution review notification', () => {
  it.each([undefined, 0])('hides the badge when the count is %s', (count) => {
    mount(count);
    const link = screen.getByRole('link', { name: 'Solution review' });
    expect(link).toBeVisible();
    expect(link).toHaveTextContent('');
  });

  it('hides the review control from users without review permission', () => {
    mount(12, false);
    expect(screen.queryByRole('link', { name: /Solution review/ })).toBeNull();
    expect(screen.queryByText('12')).toBeNull();
  });

  it('includes the pending count in the Chinese accessible label', () => {
    mount(12, true, 'zh');
    expect(
      screen.getByRole('link', { name: '题解审核：12 篇待审核' })
    ).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
  });

  it.each([375, 1280])(
    'shows the count in a red badge at the upper-right of the review button at %spx',
    async (width) => {
      await page.viewport(width, 900);
      try {
        mount(1234);
        const link = screen.getByRole('link', {
          name: 'Solution review: 1234 pending',
        });
        const badge = screen.getByText('1234');
        expect(link).toHaveAttribute('href', '/problem/solution-review');
        expect(badge).toBeVisible();
        const buttonBounds = link.getBoundingClientRect();
        const badgeBounds = badge.getBoundingClientRect();
        expect(badgeBounds.top).toBeLessThan(buttonBounds.top);
        expect(badgeBounds.right).toBeGreaterThan(buttonBounds.right);
        expect(badgeBounds.left).toBeGreaterThan(buttonBounds.left);
        expect(badgeBounds.right).toBeLessThan(width);
        expect(Math.ceil(badgeBounds.width)).toBeGreaterThanOrEqual(
          badge.scrollWidth
        );
        expect(getComputedStyle(badge).backgroundColor).toBe(
          'oklch(0.577 0.245 27.325)'
        );
      } finally {
        await page.viewport(1280, 900);
      }
    }
  );
});
