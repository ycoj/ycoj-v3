import Suggestions from './suggestions';
import type { SuggestionSection } from '@/api/server/method/ui/homepage';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

function renderSuggestions(
  sections?: SuggestionSection[],
  useDefaults = false
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Suggestions sections={sections} useDefaults={useDefaults} />
    </NextIntlClientProvider>
  );
}

describe('homepage recommended sites', () => {
  it('renders the built-in legacy list for a bare config entry', () => {
    renderSuggestions(undefined, true);

    expect(screen.getByText('Chinese')).toBeVisible();
    expect(screen.getByRole('link', { name: 'LibreOJ' })).toHaveAttribute(
      'href',
      'https://loj.ac/'
    );
    expect(screen.getByRole('link', { name: 'Codeforces' })).toBeVisible();
  });

  it('renders configured sections and skips empty groups', () => {
    renderSuggestions([
      {
        title: 'Friends',
        sites: [{ title: 'Example', link: 'https://e.test' }],
      },
      { title: 'Empty', sites: [] },
    ]);

    expect(screen.getByText('Friends')).toBeVisible();
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
  });

  it('hides itself when no section has sites', () => {
    const { container } = renderSuggestions([{ title: 'Empty', sites: [] }]);
    expect(container).toBeEmptyDOMElement();
  });
});
