import '@/app/globals.css';
import { PRIV } from './lib/priv';
import UserSpan from './user-span';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('UserSpan', () => {
  it.each([
    ['light', 'rgb(142, 68, 173)'],
    ['dark', 'rgb(192, 132, 216)'],
  ])(
    'keeps administrators purple in the %s theme without a contrasting initial',
    (theme, color) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      try {
        render(
          <UserSpan
            user={{
              _id: 2,
              uname: 'alice',
              mail: '',
              avatar: '',
              priv: PRIV.PRIV_MOD_BADGE,
              contestRating: {
                rating: 3100,
                peak: 3100,
                contests: 8,
                provisional: false,
              },
            }}
            showAvatar={false}
          />
        );
        const username = screen.getByText('alice');
        expect(username).toBeVisible();
        expect(getComputedStyle(username).color).toBe(color);
      } finally {
        document.documentElement.classList.remove('dark');
      }
    }
  );
  it('colors usernames by contest rating and gives legendary users a contrasting first letter', () => {
    const user = {
      _id: 2,
      uname: 'alice',
      mail: '',
      avatar: '',
      contestRating: {
        rating: 3100,
        peak: 3100,
        contests: 8,
        provisional: false,
      },
    };
    render(<UserSpan user={user} showAvatar={false} />);
    expect(screen.getByRole('link', { name: 'alice' })).toBeVisible();
    const initial = screen.getByText('a', { exact: true });
    const rest = screen.getByText('lice', { exact: true });
    expect(getComputedStyle(initial).color).not.toBe(
      getComputedStyle(rest).color
    );
    expect(screen.getByRole('link', { name: 'alice' })).toHaveAttribute(
      'href',
      '/user/2'
    );
  });

  it('renders the CCF hook after the username', () => {
    render(
      <UserSpan
        user={{
          _id: 2,
          uname: 'alice',
          mail: 'alice@example.com',
          avatar: '',
          ccfLevel: 6,
        }}
        showAvatar={false}
      />
    );

    const username = screen.getByText('alice');
    const hook = screen.getByRole('img', { name: 'CCF 6' });

    expect(username.compareDocumentPosition(hook)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});
