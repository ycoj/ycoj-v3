import RankingSection from './ranking';
import type { HomepageUserDict } from '@/api/server/method/ui/homepage';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

function makeUserDict(): HomepageUserDict {
  return {
    12: {
      _id: 12,
      uname: 'alice',
      mail: 'alice@example.com',
      avatar: '',
      rp: 1234.6,
      bio: '**Loves** graphs',
    },
    13: {
      _id: 13,
      uname: 'bob',
      mail: 'bob@example.com',
      avatar: '',
      rp: 90,
    },
  };
}

function renderSection(uids: number[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RankingSection uids={uids} udict={makeUserDict()} />
    </NextIntlClientProvider>
  );
}

describe('homepage ranking section', () => {
  it('lists users in server order with their ranks and rounded RP', () => {
    renderSection([12, 13]);

    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('1');
    expect(rows[0]).toHaveTextContent('alice');
    // RP is displayed rounded, like the legacy table.
    expect(rows[0]).toHaveTextContent('1235');
    expect(rows[1]).toHaveTextContent('bob');
    expect(rows[1]).toHaveTextContent('90');
  });

  it('links each user to their profile', () => {
    renderSection([12]);

    expect(screen.getByRole('link', { name: /alice/ })).toHaveAttribute(
      'href',
      '/user/12'
    );
  });

  it('skips ids without a user record and hides when nothing remains', () => {
    const { container } = renderSection([999]);
    expect(container).toBeEmptyDOMElement();

    renderSection([12, 999]);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });
});
