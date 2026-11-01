import BlogCreateForm from './blog-create-form';
import type { BlogFormValues } from '@/features/blog/lib/blog-utils';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  onSubmit: null as null | ((values: BlogFormValues) => Promise<string>),
}));

vi.mock('@/api/client/method/blog', () => ({
  default: {
    createBlog: (uid: number, title: string, content: string) => ({
      send: () => mocks.create(uid, title, content),
    }),
  },
}));

vi.mock('@/features/blog/form/blog-form', () => ({
  default: ({
    onSubmit,
    mode,
    cancelHref,
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
      </div>
    );
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.onSubmit = null;
  mocks.create.mockResolvedValue({ url: '/blog/12/new-post' });
});

function renderCreate() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BlogCreateForm uid={12} />
    </NextIntlClientProvider>
  );
}

describe('blog create form', () => {
  it('creates with the trimmed payload and opens the new post', async () => {
    renderCreate();
    expect(
      screen.getByRole('heading', { name: 'Write a post' })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/blog/12'
    );

    await expect(
      mocks.onSubmit!({ title: '  Post  ', content: ' Hello ' })
    ).resolves.toBe('/blog/12/new-post');
    expect(mocks.create).toHaveBeenCalledWith(12, 'Post', 'Hello');
  });

  it('falls back to the blog index when the response has no destination', async () => {
    mocks.create.mockResolvedValue({});
    renderCreate();

    await expect(
      mocks.onSubmit!({ title: 'Post', content: 'Hello' })
    ).resolves.toBe('/blog/12');
  });

  it('surfaces a permission error instead of treating the redirect as success', async () => {
    mocks.create.mockResolvedValue({
      error: { name: 'PermissionError', message: 'Permission denied' },
    });
    renderCreate();

    await expect(
      mocks.onSubmit!({ title: 'Post', content: 'Hello' })
    ).rejects.toThrow('Permission denied');
  });
});
