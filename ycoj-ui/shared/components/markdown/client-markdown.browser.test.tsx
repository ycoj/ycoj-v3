import ClientMarkdown from './client-markdown';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('ClientMarkdown', () => {
  it('replaces the rendered body when the source changes', async () => {
    const view = await act(async () =>
      render(<ClientMarkdown>First **version**</ClientMarkdown>)
    );

    expect(await screen.findByText('version')).toBeVisible();
    expect(screen.queryByText(/\*\*version\*\*/)).not.toBeInTheDocument();

    await act(async () => {
      view.rerender(<ClientMarkdown>Second **draft**</ClientMarkdown>);
    });

    expect(await screen.findByText('draft')).toBeVisible();
    expect(screen.queryByText('version')).not.toBeInTheDocument();
    expect(screen.queryByText(/\*\*draft\*\*/)).not.toBeInTheDocument();
  });
});
