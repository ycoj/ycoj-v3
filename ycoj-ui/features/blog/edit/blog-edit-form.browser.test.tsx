import BlogEditForm from './blog-edit-form';
import type { BlogFormValues } from '@/features/blog/lib/blog-utils';
import messages from '@/messages/en';
import type { Blog } from '@/shared/types/blog';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  onSubmit: null as null | ((values: BlogFormValues) => Promise<string>),
}));

vi.mock('@/api/client/method/blog', () => ({
  default: {
    updateBlog: (uid: number, did: string, title: string, content: string) => ({
      send: () => mocks.update(uid, did, title, content),
    }),
    deleteBlog: () => ({ send: vi.fn() }),
  },
}));

vi.mock('@/features/blog/form/blog-form', () => ({
  default: ({
    onSubmit,
    mode,
    cancelHref,
    extraActions,
  }: {
    onSubmit: (values: BlogFormValues) => Promise<string>;
    mode: 'create' | 'edit';
    cancelHref: string;
    extraActions?: (isSubmitting: boolean) => ReactNode;
  }) => {
    mocks.onSubmit = onSubmit;
    return (
      <div>
        <h1>
          {mode === 'create'
            ? messages.blog.createTitle
            : messages.blog.editTitle}
        </h1>
        <a href={cancelHref}>{messages.blog.cancel}</a>
        {extraActions?.(false)}
      </div>
    );
  },
}));

vi.mock('@/shared/components/confirm-delete-button', () => ({
  default: ({ id }: { id: string }) => (
    <button type="button">Delete {id}</button>
  ),
}));

const blog: Blog = {
  docType: 70,
  docId: 'd'.repeat(24),
  owner: 12,
  title: 'Stored title',
  content: 'Stored content',
  tags: [],
  visibility: 'public',
  ip: '127.0.0.1',
  updateAt: new Date('2026-01-01T00:00:00Z'),
  nReply: 0,
  likeCount: 0,
  views: 3,
  reply: [],
  react: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onSubmit = null;
  mocks.update.mockResolvedValue({});
});

function renderEdit() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BlogEditForm uid={12} blog={blog} />
    </NextIntlClientProvider>
  );
}

describe('blog edit form', () => {
  it('updates with the trimmed payload and returns to the post', async () => {
    renderEdit();
    expect(
      screen.getByRole('heading', { name: 'Edit post' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: `Delete ${blog.docId}` })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `/blog/12/${blog.docId}`
    );

    await expect(
      mocks.onSubmit!({ title: ' New title ', content: ' New body ' })
    ).resolves.toBe(`/blog/12/${blog.docId}`);
    expect(mocks.update).toHaveBeenCalledWith(
      12,
      blog.docId,
      'New title',
      'New body'
    );
  });

  it('throws a parsed backend error without requiring a url', async () => {
    mocks.update.mockResolvedValue({
      error: { name: 'ForbiddenError', message: 'Permission denied' },
    });
    renderEdit();

    await expect(mocks.onSubmit!({ title: 'T', content: 'C' })).rejects.toThrow(
      'Permission denied'
    );
  });
});
