import DiscussionCreateForm from './discussion-create-form';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  send: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Discussion: {
      createDiscussion: (...args: unknown[]) => {
        mocks.create(...args);
        return { send: mocks.send };
      },
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/shared/components/markdown-editor', () => ({
  default: (props: ComponentProps<'textarea'>) => (
    <textarea {...props} aria-label="Discussion content" />
  ),
}));

function mount(
  props: Partial<ComponentProps<typeof DiscussionCreateForm>> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <DiscussionCreateForm
        node={{ type: 'problem', name: 'P1000' }}
        backHref="/discussion/problem/P1000"
        canHighlight={false}
        canPin={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => vi.resetAllMocks());

describe('discussion topic creation', () => {
  it('submits the node, title and content and opens the new topic', async () => {
    mocks.send.mockResolvedValue({ did: 'did-new', url: '/discuss/did-new' });
    mount();
    await userEvent.type(
      screen.getByRole('textbox', {
        name: messages.discussion.createForm.title,
      }),
      'How to solve P1000?'
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Discussion content' }),
      'Use a linear scan.'
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: messages.discussion.createForm.submit,
      })
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith('problem', 'P1000', {
        type: 'problem',
        title: 'How to solve P1000?',
        content: 'Use a linear scan.',
        highlight: false,
        pin: false,
      })
    );
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/discussion/did-new')
    );
  });

  it('requires a title and content before sending', async () => {
    mount();
    await userEvent.click(
      screen.getByRole('button', {
        name: messages.discussion.createForm.submit,
      })
    );
    expect(
      await screen.findByText(messages.discussion.createForm.titleRequired)
    ).toBeVisible();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('only exposes pin and highlight to permitted authors', async () => {
    const { unmount } = mount();
    expect(
      screen.queryByRole('checkbox', {
        name: messages.discussion.createForm.pin,
      })
    ).not.toBeInTheDocument();
    unmount();

    mocks.send.mockResolvedValue({ did: 'did-new' });
    mount({ canHighlight: true, canPin: true });
    await userEvent.type(
      screen.getByRole('textbox', {
        name: messages.discussion.createForm.title,
      }),
      'Featured'
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Discussion content' }),
      'Body'
    );
    await userEvent.click(
      screen.getByRole('checkbox', { name: messages.discussion.createForm.pin })
    );
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: messages.discussion.createForm.highlight,
      })
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: messages.discussion.createForm.submit,
      })
    );
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith(
        'problem',
        'P1000',
        expect.objectContaining({ highlight: true, pin: true })
      )
    );
  });

  it('keeps the input and shows the backend error on failure', async () => {
    mocks.send.mockResolvedValue({
      error: { name: 'RateLimitExceededError', message: 'Too many topics' },
    });
    mount();
    await userEvent.type(
      screen.getByRole('textbox', {
        name: messages.discussion.createForm.title,
      }),
      'Title'
    );
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Discussion content' }),
      'Body'
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: messages.discussion.createForm.submit,
      })
    );
    expect(await screen.findByText('Too many topics')).toBeVisible();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(
      screen.getByRole('textbox', {
        name: messages.discussion.createForm.title,
      })
    ).toHaveValue('Title');
  });
});
