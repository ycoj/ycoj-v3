import DiscussionRepliesClient from './discussion-replies-client';
import type { DiscussionPermissionFlags } from '@/features/discussion/lib/permissions';
import messages from '@/messages/en';
import type { DiscussionReplyDoc } from '@/shared/types/discussion';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  reply: vi.fn(),
  tailReply: vi.fn(),
  edit: vi.fn(),
  remove: vi.fn(),
  editTail: vi.fn(),
  removeTail: vi.fn(),
  react: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
}));

function method(handler: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    handler(...args);
    return { send: mocks.send };
  };
}

vi.mock('@/api/client/method', () => ({
  default: {
    Discussion: {
      replyDiscussion: method(mocks.reply),
      replyDiscussionTail: method(mocks.tailReply),
      editDiscussionReply: method(mocks.edit),
      deleteDiscussionReply: method(mocks.remove),
      editDiscussionTailReply: method(mocks.editTail),
      deleteDiscussionTailReply: method(mocks.removeTail),
      reactToDiscussion: method(mocks.react),
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  usePathname: () => '/discussion/did-1',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/shared/components/markdown/client-markdown', () => ({
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown">{children}</div>
  ),
}));

function permissions(
  overrides: Partial<DiscussionPermissionFlags> = {}
): DiscussionPermissionFlags {
  return {
    canCreate: false,
    canEditAny: false,
    canEditSelf: false,
    canDeleteAny: false,
    canDeleteSelf: false,
    canPin: false,
    canHighlight: false,
    canLock: false,
    canReply: false,
    canEditReplySelf: false,
    canDeleteReply: false,
    canDeleteReplySelf: false,
    canDeleteReplyAsOwner: false,
    canReact: false,
    ...overrides,
  };
}

const drdocs: DiscussionReplyDoc[] = [
  {
    docId: 'drid-mine',
    _id: 'drid-mine',
    docType: 22,
    owner: 42,
    content: 'My reply',
    ip: '',
    react: {},
    reply: [
      {
        _id: 'drrid-mine',
        owner: 42,
        content: 'My tail reply',
        ip: '',
      },
      {
        _id: 'drrid-other',
        owner: 7,
        content: 'Other tail reply',
        ip: '',
      },
    ],
  },
  {
    docId: 'drid-other',
    _id: 'drid-other',
    docType: 22,
    owner: 7,
    content: 'Other reply',
    ip: '',
    react: { '👍': 1 },
  },
];

const udict = {
  42: { _id: 42, uname: 'me', mail: '', avatar: '' },
  7: { _id: 7, uname: 'other', mail: '', avatar: '' },
};

function mount(
  overrides: Partial<DiscussionPermissionFlags> = {},
  options: {
    viewerId?: number;
    topicOwner?: number;
    topicLocked?: boolean;
    reactions?: Record<string, Record<string, number>>;
  } = {}
) {
  const { viewerId = 42, topicOwner = 70, topicLocked = false } = options;
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DiscussionRepliesClient
        did="did-1"
        drdocs={drdocs}
        udict={udict}
        page={1}
        pcount={1}
        currentUser={udict[42]}
        viewerId={viewerId}
        permissions={permissions(overrides)}
        topicOwner={topicOwner}
        topicLocked={topicLocked}
        reactions={options.reactions ?? {}}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('discussion reply actions', () => {
  it('renders reply bodies as Markdown', () => {
    mount();
    const bodies = screen.getAllByTestId('markdown');
    expect(bodies.map((body) => body.textContent)).toEqual(
      expect.arrayContaining(['My reply', 'Other reply'])
    );
  });

  it('shows edit only on replies owned by the viewer', () => {
    mount({ canEditReplySelf: true });
    // The viewer owns the first floor reply and one of its tail replies.
    const editButtons = screen.getAllByRole('button', {
      name: messages.discussion.replies.edit,
    });
    expect(editButtons).toHaveLength(2);
    const articles = screen.getAllByRole('article');
    expect(
      within(articles[1]).queryByRole('button', {
        name: messages.discussion.replies.edit,
      })
    ).not.toBeInTheDocument();
  });

  it('never offers editing to a moderator for another author reply', () => {
    mount({ canEditReplySelf: true, canEditAny: true }, { viewerId: 1 });
    expect(
      screen.queryByRole('button', { name: messages.discussion.replies.edit })
    ).not.toBeInTheDocument();
  });

  it('lets the topic owner delete replies through the owner permission', () => {
    mount({ canDeleteReplyAsOwner: true }, { viewerId: 70, topicOwner: 70 });
    expect(
      screen.getAllByRole('button', {
        name: messages.discussion.replies.delete,
      })
    ).toHaveLength(2);
  });

  it('offers tail-reply edit and delete under the tail-reply author rules', () => {
    mount({ canEditReplySelf: true, canDeleteReplySelf: true });
    // Two floor replies owned by the viewer produce one edit action each; the
    // viewer-owned tail reply adds another.
    expect(
      screen.getAllByRole('button', { name: messages.discussion.replies.edit })
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('button', {
        name: messages.discussion.replies.delete,
      })
    ).toHaveLength(2);
  });

  it('edits a tail reply and refreshes', async () => {
    mocks.send.mockResolvedValue({ url: '/discuss/did-1' });
    mount({ canEditReplySelf: true });
    // The tail replies are the only edit buttons after the floor reply's.
    const editButtons = screen.getAllByRole('button', {
      name: messages.discussion.replies.edit,
    });
    await userEvent.click(editButtons[editButtons.length - 1]);
    const textbox = screen.getByRole('textbox', {
      name: messages.discussion.replies.editFormLabel,
    });
    await userEvent.clear(textbox);
    await userEvent.type(textbox, 'Edited tail');
    await userEvent.click(
      screen.getByRole('button', { name: messages.discussion.replies.save })
    );
    await waitFor(() =>
      expect(mocks.editTail).toHaveBeenCalledWith(
        'did-1',
        'drid-mine',
        'drrid-mine',
        'Edited tail'
      )
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('hides the composer and shows the locked notice on a locked topic', () => {
    mount({ canReply: true }, { topicLocked: true });
    expect(screen.getByText(messages.discussion.replies.locked)).toBeVisible();
    expect(
      screen.queryByRole('button', {
        name: messages.discussion.replies.comment,
      })
    ).not.toBeInTheDocument();
  });

  it('toggles an existing reaction and refreshes', async () => {
    mocks.send.mockResolvedValue({ doc: { react: { '👍': 2 } } });
    mount(
      { canReact: true },
      { reactions: { 'did-1': { '👍': 1 }, 'drid-other': { '👍': 1 } } }
    );
    const reaction = screen.getByRole('button', { name: '👍 1' });
    expect(reaction).toHaveTextContent('1');
    await userEvent.click(reaction);
    await waitFor(() =>
      expect(mocks.react).toHaveBeenCalledWith(
        'did-1',
        'drid',
        'drid-other',
        '👍',
        true
      )
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('does not offer reactions without permission', () => {
    mount();
    expect(
      screen.queryByRole('button', { name: messages.discussion.reactions.add })
    ).not.toBeInTheDocument();
  });
});
