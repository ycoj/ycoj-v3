import { loadVelocitex } from '../velocitex';
import MarkdownMath from './markdown-math';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../velocitex', () => ({ loadVelocitex: vi.fn() }));

const load = vi.mocked(loadVelocitex);

beforeEach(() => load.mockReset());

function formula(source: string) {
  return <span data-math-source={source}>{source}</span>;
}

describe('Markdown math lifecycle', () => {
  it('does not load the runtime for prose or code examples', () => {
    render(
      <MarkdownMath>
        <p>Plain prose</p>
        <code>$x^2$</code>
      </MarkdownMath>
    );
    expect(screen.getByText('$x^2$')).toBeVisible();
    expect(load).not.toHaveBeenCalled();
  });

  it('retains readable TeX while loading and after a runtime failure', async () => {
    const pending = Promise.withResolvers<void>();
    load.mockImplementation(async () => {
      await pending.promise;
      return {
        renderToString() {
          throw new Error('Runtime unavailable');
        },
      } as unknown as Awaited<ReturnType<typeof loadVelocitex>>;
    });
    render(<MarkdownMath>{formula(String.raw`\frac{a}{b}`)}</MarkdownMath>);
    expect(screen.getByText(String.raw`\frac{a}{b}`)).toBeVisible();
    pending.resolve();
    await waitFor(() =>
      expect(screen.getByText(String.raw`\frac{a}{b}`)).toHaveAttribute(
        'data-math-state',
        'error'
      )
    );
    expect(screen.getByText(String.raw`\frac{a}{b}`)).toBeVisible();
  });

  it('does not let a delayed formula replace newer preview content', async () => {
    let resolveOld: (html: string) => void = () => {};
    const renderToString = vi.fn((source: string) =>
      source === 'old'
        ? new Promise<string>((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve('<span>Current formula</span>')
    );
    load.mockResolvedValue({ renderToString } as unknown as Awaited<
      ReturnType<typeof loadVelocitex>
    >);
    const { rerender } = render(<MarkdownMath>{formula('old')}</MarkdownMath>);
    await waitFor(() =>
      expect(renderToString).toHaveBeenCalledWith('old', expect.anything())
    );
    rerender(<MarkdownMath>{formula('new')}</MarkdownMath>);
    await waitFor(() =>
      expect(screen.getByText('Current formula')).toBeVisible()
    );
    await act(async () => resolveOld('<span>Obsolete formula</span>'));
    expect(screen.getByText('Current formula')).toBeVisible();
    expect(screen.queryByText('Obsolete formula')).not.toBeInTheDocument();
  });
});
