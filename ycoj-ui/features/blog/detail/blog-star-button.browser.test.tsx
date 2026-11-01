import BlogStarButton from './blog-star-button';
import messages from '@/messages/en';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  star: vi.fn(),
  unstar: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/api/client/method/blog', () => ({
  default: {
    starBlog: (uid: number, did: string) => ({
      send: () => mocks.star(uid, did),
    }),
    unstarBlog: (uid: number, did: string) => ({
      send: () => mocks.unstar(uid, did),
    }),
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock('sonner', () => ({
  toast: { error: mocks.toastError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.star.mockResolvedValue({ url: '/blog/12/abc?star=true' });
  mocks.unstar.mockResolvedValue({ url: '/blog/12/abc?star=false' });
});

function renderButton(starred: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BlogStarButton uid={12} did="abc" starred={starred} />
    </NextIntlClientProvider>
  );
}

describe('blog star button', () => {
  it('stars an unstarred post and refreshes the page', async () => {
    renderButton(false);
    const button = screen.getByRole('button', { name: 'Star' });
    expect(button).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(button);

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.star).toHaveBeenCalledWith(12, 'abc');
  });

  it('unstars a starred post', async () => {
    renderButton(true);
    const button = screen.getByRole('button', { name: 'Starred' });
    expect(button).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(button);

    await waitFor(() => expect(mocks.unstar).toHaveBeenCalledWith(12, 'abc'));
  });

  it('reports a backend error without refreshing', async () => {
    mocks.star.mockResolvedValue({
      error: { name: 'PermissionError', message: 'Permission denied' },
    });
    renderButton(false);

    fireEvent.click(screen.getByRole('button', { name: 'Star' }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith('Permission denied')
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
