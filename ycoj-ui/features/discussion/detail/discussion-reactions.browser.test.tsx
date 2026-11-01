import DiscussionReactions from './discussion-reactions';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  react: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Discussion: {
      reactToDiscussion: (...args: unknown[]) => {
        mocks.react(...args);
        return { send: mocks.send };
      },
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

function mount(props: {
  reactions?: Record<string, number>;
  ownReactions?: Record<string, number>;
  canReact?: boolean;
}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DiscussionReactions
        did="did-1"
        nodeType="did"
        id="did-1"
        reactions={props.reactions ?? {}}
        ownReactions={props.ownReactions ?? {}}
        canReact={props.canReact ?? true}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('discussion reactions', () => {
  it('shows counts sorted by popularity and marks the viewer reaction', () => {
    mount({
      reactions: { '👍': 3, '❤️': 1 },
      ownReactions: { '👍': 1 },
    });
    const buttons = screen.getAllByRole('button', { name: /^[👍❤️]/ });
    expect(buttons[0]).toHaveTextContent('👍');
    expect(buttons[0]).toHaveTextContent('3');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'false');
  });

  it('adds a new reaction from the picker', async () => {
    mocks.send.mockResolvedValue({ doc: { react: { '😄': 1 } } });
    mount({});
    await userEvent.click(
      screen.getByRole('button', { name: messages.discussion.reactions.add })
    );
    await userEvent.click(screen.getByRole('button', { name: '😄' }));
    await waitFor(() =>
      expect(mocks.react).toHaveBeenCalledWith(
        'did-1',
        'did',
        'did-1',
        '😄',
        false
      )
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('reverses an existing reaction', async () => {
    mocks.send.mockResolvedValue({ doc: { react: {} } });
    mount({ reactions: { '👍': 2 }, ownReactions: { '👍': 1 } });
    await userEvent.click(screen.getByRole('button', { name: '👍 2' }));
    await waitFor(() =>
      expect(mocks.react).toHaveBeenCalledWith(
        'did-1',
        'did',
        'did-1',
        '👍',
        true
      )
    );
  });

  it('keeps the current counts and shows the error when the request fails', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'PermissionError', message: 'Reaction not allowed' },
    });
    mount({ reactions: { '👍': 2 } });
    await userEvent.click(screen.getByRole('button', { name: '👍 2' }));
    expect(await screen.findByText('Reaction not allowed')).toBeVisible();
    expect(screen.getByRole('button', { name: '👍 2' })).toHaveTextContent('2');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('renders nothing for an anonymous viewer without reactions', () => {
    const { container } = mount({ canReact: false });
    expect(container).toBeEmptyDOMElement();
  });
});
