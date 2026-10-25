import './editor-config';
import MarkdownMath from '@/shared/components/markdown/components/markdown-math';
import { render, screen, waitFor } from '@testing-library/react';
import { MdEditor } from 'md-editor-rt';
import { describe, expect, it } from 'vitest';

function preview(value: string) {
  return (
    <MarkdownMath className="">
      <MdEditor
        value={value}
        toolbars={[]}
        footers={[]}
        noPrettier
        noHighlight
        noMermaid
        noImgZoomIn
      />
    </MarkdownMath>
  );
}

describe('VelociTex editor preview', () => {
  it('renders inline and display formulas and replaces edited content', async () => {
    const { container, rerender } = render(
      preview('Inline $x^2$\n\n$$\n\\frac{a}{b}\n$$')
    );
    await waitFor(() =>
      expect(container.querySelectorAll('.katex-html')).toHaveLength(2)
    );
    expect(container.querySelector('.katex-display')).toBeVisible();
    expect(container.querySelector('.katex-html')).toHaveTextContent('x2');
    rerender(preview(String.raw`Updated $\sqrt{y}$`));
    await waitFor(() => {
      expect(container.querySelectorAll('.katex-html')).toHaveLength(1);
      expect(container.querySelector('.katex-html')).toHaveTextContent('y');
    });
  });

  it('keeps code examples literal and untrusted TeX commands inert', async () => {
    const { container } = render(
      preview('Code: `$x$` and $\\htmlClass{injected}{x}$')
    );
    await waitFor(() =>
      expect(container.querySelector('.katex')).toBeVisible()
    );
    expect(screen.getByText('$x$', { selector: 'code' })).toBeVisible();
    expect(container.querySelector('.injected')).not.toBeInTheDocument();
  });
});
