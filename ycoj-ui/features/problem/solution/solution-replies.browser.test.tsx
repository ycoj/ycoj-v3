import SolutionReplies from './solution-replies';
import type { SolutionPermissionFlags } from './solution-reply-permissions';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reply: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method/problem/solution-reply', () => ({
  replyProblemSolution: (...args: unknown[]) => {
    mocks.reply(...args);
    return { send: mocks.send };
  },
  editProblemSolutionReply: (...args: unknown[]) => {
    mocks.edit(...args);
    return { send: mocks.send };
  },
  deleteProblemSolutionReply: (...args: unknown[]) => {
    mocks.remove(...args);
    return { send: mocks.send };
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('@/shared/components/markdown/client-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

function permissions(
  overrides: Partial<SolutionPermissionFlags> = {}
): SolutionPermissionFlags {
  return {
    allowEditAny: false,
    allowEditSelf: false,
    allowDeleteAny: false,
    allowDeleteSelf: false,
    allowReply: false,
    allowEditReplySelf: false,
    allowDeleteReplyAny: false,
    allowDeleteReplySelf: false,
    ...overrides,
  };
}

const replies = [
  { _id: 'reply-mine', owner: 42, content: 'My **reply**' },
  { _id: 'reply-other', owner: 7, content: 'Someone else' },
];

function mount(
  overrides: Partial<SolutionPermissionFlags> = {},
  viewerId = 42,
  canReply = false
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SolutionReplies
        pid={1}
        psid="solution-1"
        replies={replies}
        udict={{
          42: { _id: 42, uname: 'me', mail: '', avatar: '' },
          7: { _id: 7, uname: 'other', mail: '', avatar: '' },
        }}
        viewerId={viewerId}
        permissions={permissions(overrides)}
        canReply={canReply}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('solution reply actions', () => {
  it('shows edit and delete only on the viewer-owned reply', () => {
    mount({ allowEditReplySelf: true, allowDeleteReplySelf: true });
    expect(
      screen.getAllByRole('button', { name: messages.solution.replies.edit })
    ).toHaveLength(1);
    expect(
      screen.getAllByRole('button', {
        name: messages.solution.replies.delete,
      })
    ).toHaveLength(1);
  });

  it('offers no actions without reply permissions', () => {
    mount();
    expect(
      screen.queryByRole('button', { name: messages.solution.replies.edit })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.solution.replies.delete })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: messages.solution.replies.reply })
    ).not.toBeInTheDocument();
  });

  it('lets a moderator delete any reply but not edit it', () => {
    mount({ allowDeleteReplyAny: true }, 1);
    expect(
      screen.getAllByRole('button', { name: messages.solution.replies.delete })
    ).toHaveLength(2);
    expect(
      screen.queryByRole('button', { name: messages.solution.replies.edit })
    ).not.toBeInTheDocument();
  });

  it('renders reply bodies as Markdown', () => {
    mount();
    expect(screen.getAllByTestId('markdown')).toHaveLength(2);
    expect(screen.getByText('My **reply**')).toBeVisible();
  });

  it('edits the viewer-owned reply in place', async () => {
    mocks.send.mockResolvedValue({ url: '/problem/1/solution' });
    mount({ allowEditReplySelf: true });
    await userEvent.click(
      screen.getByRole('button', { name: messages.solution.replies.edit })
    );
    const textbox = screen.getByRole('textbox', {
      name: messages.solution.replies.edit,
    });
    await userEvent.clear(textbox);
    await userEvent.type(textbox, 'Updated reply');
    await userEvent.click(
      screen.getByRole('button', { name: messages.solution.replies.save })
    );
    await waitFor(() =>
      expect(mocks.edit).toHaveBeenCalledWith(
        1,
        'solution-1',
        'reply-mine',
        'Updated reply'
      )
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('posts a reply to the solution when allowed', async () => {
    mocks.send.mockResolvedValue({ url: '/problem/1/solution' });
    mount({ allowReply: true }, 42, true);
    await userEvent.click(
      screen.getByRole('button', { name: messages.solution.replies.reply })
    );
    await userEvent.type(
      screen.getByRole('textbox', {
        name: messages.solution.replies.replyLabel,
      }),
      'Thanks'
    );
    await userEvent.click(
      screen.getByRole('button', { name: messages.solution.replies.save })
    );
    await waitFor(() =>
      expect(mocks.reply).toHaveBeenCalledWith(1, 'solution-1', 'Thanks')
    );
  });

  it('shows a backend error without refreshing', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'PermissionError', message: 'Not allowed' },
    });
    mount({ allowReply: true }, 42, true);
    await userEvent.click(
      screen.getByRole('button', { name: messages.solution.replies.reply })
    );
    await userEvent.type(
      screen.getByRole('textbox', {
        name: messages.solution.replies.replyLabel,
      }),
      'Thanks'
    );
    await userEvent.click(
      screen.getByRole('button', { name: messages.solution.replies.save })
    );
    expect(await screen.findByText('Not allowed')).toBeVisible();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
