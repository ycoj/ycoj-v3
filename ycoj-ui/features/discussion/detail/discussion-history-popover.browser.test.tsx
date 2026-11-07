import DiscussionHistoryPopover from './discussion-history-popover';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Discussion: {
      getDiscussionHistory: () => ({ send: mocks.send }),
    },
  },
}));

const latestTime = '2026-03-01T08:30:00.000Z';
const earlierTime = '2026-02-01T00:00:00.000Z';

function mount() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DiscussionHistoryPopover did="6acf811d44b75debc7abb1b1" />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mocks.send.mockReset();
  mocks.send.mockResolvedValue({
    history: [
      {
        content: 'Fixed the **sample** explanation.',
        time: latestTime,
        uid: 42,
      },
      {
        content: 'See the [guide](https://example.com/guide).',
        time: earlierTime,
        uid: 7,
      },
    ],
  });
});

describe('discussion edit history', () => {
  it('renders earlier versions as markdown when the history opens', async () => {
    mount();

    await userEvent.click(
      screen.getByRole('button', { name: messages.discussion.history.edited })
    );

    expect(
      await screen.findByText(messages.discussion.history.title)
    ).toBeVisible();
    const sample = await screen.findByText('sample');
    expect(sample).toBeVisible();
    expect(screen.queryByText(/\*\*sample\*\*/)).not.toBeInTheDocument();
    expect(
      Number.parseInt(getComputedStyle(sample).fontWeight, 10)
    ).toBeGreaterThanOrEqual(600);
    expect(screen.getByRole('link', { name: 'guide' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'guide' })).toHaveAttribute(
      'href',
      'https://example.com/guide'
    );
    expect(screen.getByText('42')).toBeVisible();
    expect(screen.getByText('7')).toBeVisible();
    expect(
      screen.getByText(dayjs(latestTime).format('YYYY-MM-DD HH:mm'))
    ).toBeVisible();
    expect(
      screen.getByText(dayjs(earlierTime).format('YYYY-MM-DD HH:mm'))
    ).toBeVisible();
  });
});
