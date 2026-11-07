import '@/app/globals.css';
import DiscussionTitle from './discussion-title';
import messages from '@/messages/en';
import type { DiscussionDoc } from '@/shared/types/discussion';
import type { BaseUser } from '@/shared/types/user';
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
  }: ComponentProps<'a'> & { prefetch?: boolean }) => (
    <a href={typeof href === 'string' ? href : undefined} className={className}>
      {children}
    </a>
  ),
}));

const owner: BaseUser = {
  _id: 1,
  uname: 'sunzhenxuan',
  mail: 'sunzhenxuan@example.com',
  avatar: '',
};

function makeDoc(title: string): DiscussionDoc {
  return {
    _id: 'd'.repeat(24),
    docId: 'd'.repeat(24),
    docType: 21,
    domainId: 'system',
    owner: owner._id,
    parentType: 20,
    parentId: 'share',
    title,
    content: '',
    pin: true,
    highlight: false,
    updateAt: new Date('2026-10-17T08:00:00Z'),
    nReply: 1,
    views: 20,
    react: {},
  };
}

function mount(title = '题目，欢迎来做') {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DiscussionTitle
        ddoc={makeDoc(title)}
        owner={owner}
        vnode={{ title: 'Share' }}
        drcount={1}
        actions={<button type="button">Follow topic</button>}
      />
    </NextIntlClientProvider>
  );
}

describe('DiscussionTitle layout', () => {
  it('keeps the back link out of the title block', () => {
    mount();
    expect(
      screen.queryByRole('link', { name: /back to discussions/i })
    ).toBeNull();
    expect(
      screen.getByRole('heading', { level: 1, name: '题目，欢迎来做' })
    ).toBeVisible();
    expect(screen.getByText('sunzhenxuan')).toBeVisible();
    expect(screen.getByText('Share')).toBeVisible();
    expect(screen.getByText('Replies')).toBeVisible();
    expect(screen.getByText('20')).toBeVisible();
  });

  it('places counts and actions on the right of the title when the page is wide', async () => {
    await page.viewport(1280, 900);
    try {
      mount();
      const title = screen.getByRole('heading', { level: 1 });
      const header = title.closest('header');
      const replies = screen.getByText('Replies');
      const follow = screen.getByRole('button', { name: 'Follow topic' });
      const node = screen.getByText('Share');
      const author = screen.getByText('sunzhenxuan');
      if (!header) throw new Error('missing header');

      const headerBox = header.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const repliesBox = replies.getBoundingClientRect();
      const followBox = follow.getBoundingClientRect();
      const nodeBox = node.getBoundingClientRect();
      const authorBox = author.getBoundingClientRect();

      expect(headerBox.right - headerBox.left).toBeGreaterThan(1000);
      expect(repliesBox.left).toBeGreaterThan(titleBox.left + 320);
      expect(headerBox.right - followBox.right).toBeLessThan(8);
      expect(repliesBox.top).toBeLessThan(authorBox.top);
      expect(repliesBox.bottom).toBeGreaterThan(titleBox.top);
      expect(nodeBox.top).toBeGreaterThan(titleBox.bottom - 4);
      expect(followBox.right).toBeLessThanOrEqual(1280);
    } finally {
      await page.viewport(1280, 900);
    }
  });

  it('stacks counts under the title without overflow on a narrow screen', async () => {
    await page.viewport(390, 844);
    try {
      mount('题目，欢迎来做，这是一个比较长的讨论标题用来检查换行');
      const title = screen.getByRole('heading', { level: 1 });
      const replies = screen.getByText('Replies');
      const views = screen.getByText('Views');
      const follow = screen.getByRole('button', { name: 'Follow topic' });
      const titleBox = title.getBoundingClientRect();
      const repliesBox = replies.getBoundingClientRect();
      const viewsBox = views.getBoundingClientRect();
      const followBox = follow.getBoundingClientRect();

      expect(repliesBox.top).toBeGreaterThanOrEqual(titleBox.bottom - 1);
      expect(repliesBox.left).toBeLessThan(titleBox.left + 120);
      expect(viewsBox.right).toBeLessThanOrEqual(390);
      expect(followBox.right).toBeLessThanOrEqual(390);
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth + 1);
    } finally {
      await page.viewport(1280, 900);
    }
  });
});
