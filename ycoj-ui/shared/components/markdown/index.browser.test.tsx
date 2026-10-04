// The alignment fix depends on Tailwind's preflight (images are block-level
// there); the app loads it through the root stylesheet, so tests that assert
// image layout must load it too.
import '../../../app/globals.css';
import Markdown from '.';
import messages from '@/messages/en';
import { resolveFileUrls } from '@/shared/lib/resolve-file-urls';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { Children, type ReactElement, type ReactNode } from 'react';
import { MarkdownAsync, type Options } from 'react-markdown';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ highlighterFactories: 0 }));

// Count how often the starry-night plugin builds its highlighter. Pages with
// many markdown blocks (preliminary papers render one per question and
// option) must not rebuild every grammar for each block.
vi.mock('rehype-starry-night', async (importOriginal) => {
  const actual = await importOriginal<typeof import('rehype-starry-night')>();
  return {
    default: (...args: Parameters<typeof actual.default>) => {
      mocks.highlighterFactories += 1;
      return actual.default(...args);
    },
  };
});

vi.mock('./components/react-pdf-viewer', () => ({
  default: () => <div aria-label="PDF document" role="document" />,
}));

function markdownWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

async function markdownElement(source: string) {
  const markdown = Markdown({ children: source });
  const children = (markdown.props as { children: ReactNode }).children;
  const asyncMarkdown = Children.toArray(children)[0] as ReactElement<Options>;

  return MarkdownAsync(asyncMarkdown.props);
}

async function renderMarkdown(source: string) {
  return render(await markdownElement(source), { wrapper: markdownWrapper });
}

async function renderMarkdownDocument(source: string) {
  const rendered = await markdownElement(source);

  return render(<div className="markdown">{rendered}</div>, {
    wrapper: markdownWrapper,
  });
}

describe('Markdown highlighter reuse', () => {
  it('does not rebuild the syntax highlighter for every block', async () => {
    const builtBefore = mocks.highlighterFactories;

    await renderMarkdown('first block');
    await renderMarkdown('second block');

    expect(mocks.highlighterFactories).toBe(builtBefore);
  });
});

describe('Markdown math rendering', () => {
  it.each([
    [String.raw`Literal \$x\$ and $y$`, 'Literal $x$ and'],
    [String.raw`Literal \$$x\$$ and $y$`, 'Literal $$x$$ and'],
    [String.raw`Literal \\(x\\) and $y$`, String.raw`Literal \(x\) and`],
    ['Literal &#36;x&#36; and $y$', 'Literal $x$ and'],
  ])(
    'shows escaped formula examples literally: %s',
    async (source, literal) => {
      const { container } = await renderMarkdownDocument(source);
      expect(container).toHaveTextContent(literal);
      const formulas = container.querySelectorAll('.katex-html');
      expect(formulas).toHaveLength(1);
      expect(formulas[0]).toBeVisible();
      expect(formulas[0]).toHaveTextContent('y');
    }
  );

  it('renders adjacent formulas without losing later formulas or prose', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`Before $x$$y$ / \(z\) after`
    );
    const formulas = container.querySelectorAll('.katex-html');
    expect(formulas).toHaveLength(3);
    for (const [index, symbol] of ['x', 'y', 'z'].entries()) {
      expect(formulas[index]).toBeVisible();
      expect(formulas[index]).toHaveTextContent(symbol);
    }
    expect(container).toHaveTextContent('Before');
    expect(container).toHaveTextContent('after');
  });

  it('keeps container-like formula text inside the formula', async () => {
    const { container } = await renderMarkdownDocument(
      'Before $\\text{\n:::warning\n:::\n}$ after'
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(container.querySelector('.katex-html')).toBeVisible();
    expect(container.querySelector('.katex-html')).toHaveTextContent(
      ':::warning :::'
    );
    expect(container).toHaveTextContent('Before');
    expect(container).toHaveTextContent('after');
  });

  it('keeps dollar signs inside a TeX group within the same formula', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`$\text{cost \$5} + x$`
    );
    expect(container.querySelector('.katex-html')).toHaveTextContent(
      'cost $5+x'
    );
    expect(container.querySelector('annotation')).toHaveTextContent(
      String.raw`\text{cost \$5} + x`
    );
  });

  it('renders same-line display delimiters without consuming surrounding prose', async () => {
    const { container } = await renderMarkdownDocument('Before $$x^2$$ after');
    expect(container.querySelector('.katex-display')).toBeVisible();
    expect(container.querySelector('.katex-html')).toHaveTextContent('x2');
    expect(container).toHaveTextContent('Before');
    expect(container).toHaveTextContent('after');
  });

  it('renders multiline formulas with content on the opening line and blank lines inside', async () => {
    const { container } = await renderMarkdownDocument('$$a\n=\nb\n\n+c$$');
    expect(container.querySelector('.katex-html')).toHaveTextContent('a=b+c');
    expect(container.querySelector('h1')).not.toBeInTheDocument();
  });

  it('renders formulas in sanitized HTML while preserving literal HTML text', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`<div>Literal **stars** and \(x_1\), then $$y^2$$.</div>`
    );
    expect(container.querySelectorAll('.katex-html')).toHaveLength(2);
    expect(container).toHaveTextContent('Literal **stars** and');
    expect(container.querySelector('.katex-display')).toBeVisible();
  });

  it('keeps math examples in code literal, including math-language fences', async () => {
    const { container } = await renderMarkdownDocument(
      '`$x$`\n\n```math\n$$y^2$$\n```\n\n<pre><code>$z$</code></pre>'
    );
    expect(container.querySelector('.katex')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('$x$');
    expect(container).toHaveTextContent('$$y^2$$');
    expect(container).toHaveTextContent('$z$');
  });

  it('preserves an unterminated formula and subsequent Markdown content', async () => {
    const { container } = await renderMarkdownDocument(
      '$$\nnever closed\n\n# Heading'
    );
    expect(container.querySelector('.katex')).not.toBeInTheDocument();
    expect(container).toHaveTextContent('$$');
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
  });

  it('shows invalid TeX as an error without losing the surrounding content', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`Before $\unknowncommand$ after`
    );
    const error = screen.getByText(String.raw`\unknowncommand`, {
      selector: '.katex-html span',
    });
    expect(error).toBeVisible();
    expect(error).toHaveStyle({ color: 'rgb(204, 0, 0)' });
    expect(container).toHaveTextContent('Before');
    expect(container).toHaveTextContent('after');
  });

  it.each([String.raw`\\`, String.raw`\cr`])(
    'renders a multiline matrix equation with %s row separators',
    async (rowSeparator) => {
      const source = String.raw`$$
\begin{pmatrix}
a_{i+1}\\
b_{i+1}\\
c_{i+1}
\end{pmatrix}
=
\begin{pmatrix}
1&0&1\\
1&1&1\\
1&2&2
\end{pmatrix}
\begin{pmatrix}
a_i\\
b_i\\
c_i
\end{pmatrix}
$$`.replaceAll(String.raw`\\`, rowSeparator);
      const { container } = await renderMarkdownDocument(
        `Before the equation\n\n${source}\n\nAfter the equation`
      );

      await waitFor(() => {
        expect(container.querySelector('.katex-html')).toHaveTextContent('=');
      });
      expect(container.querySelector('annotation')).toHaveTextContent(
        source.slice(2, -2).trim().replace(/\s+/g, ' ')
      );
      expect(container.querySelector('h1')).not.toBeInTheDocument();
      expect(container).not.toHaveTextContent('$$');
      expect(screen.getByText('Before the equation')).toBeVisible();
      expect(screen.getByText('After the equation')).toBeVisible();

      const rowTop = (symbol: string) =>
        screen
          .getAllByText(symbol, { selector: '.katex-html .mathnormal' })[0]
          .getBoundingClientRect().top;
      expect(rowTop('a')).toBeLessThan(rowTop('b'));
      expect(rowTop('b')).toBeLessThan(rowTop('c'));
    }
  );

  it('renders escaped percent signs alongside LaTeX commands', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`$50\% \le 100\%$`
    );

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent(
        '50%≤100%'
      );
    });
  });

  it('renders escaped punctuation and literal underscores', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`$a\_b \& c \# d \{e\}$`
    );

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent(
        'a_b&c#d{e}'
      );
    });
  });

  it('renders subscripts after underscore escaping', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`$x_i^2 + y_{jk}$`
    );

    await waitFor(() => {
      expect(container.querySelector('annotation')).toHaveTextContent(
        'x_i^2 + y_{jk}'
      );
    });
  });

  it('renders bare asterisks in math', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`$a^{*}b^{*}$`
    );

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent('a∗b∗');
    });
  });

  it('renders angle brackets in math', async () => {
    const { container } = await renderMarkdownDocument(String.raw`$a<b>c$`);

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent('a<b>c');
    });
  });

  it('renders tildes as spacing instead of strikethrough', async () => {
    const { container } = await renderMarkdownDocument(String.raw`$a~b~c$`);

    await waitFor(() => {
      const math = container.querySelector('.katex-html');
      expect(math).not.toBeNull();
      expect(math?.textContent).toMatch(/^a\s+b\s+c$/);
      expect(container.querySelector('del')).not.toBeInTheDocument();
    });
  });

  it('renders inline math written with LaTeX paren delimiters', async () => {
    const { container } = await renderMarkdownDocument(
      String.raw`The term \(x_1^2\) grows quickly`
    );

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent('x12');
    });
    const paragraph = container.querySelector('p');
    expect(paragraph?.textContent).toContain('The term');
    expect(paragraph?.textContent).toContain('grows quickly');
  });

  it('renders math inside an info container', async () => {
    const { container } = await renderMarkdownDocument(':::info\n$x^2$\n:::');

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent('x2');
    });
  });

  it('renders math inside a titled info container after it is opened', async () => {
    const user = userEvent.setup();
    const { container } = await renderMarkdownDocument(
      ':::info[Heads up]\n$x^2$\n:::'
    );

    await user.click(screen.getByRole('button', { name: 'Heads up' }));

    await waitFor(() => {
      expect(container.querySelector('.katex-html')).toHaveTextContent('x2');
    });
  });
});

describe('Markdown PDF rendering', () => {
  it('renders the custom PDF syntax through the sanitized pipeline', async () => {
    await renderMarkdown('@[pdf](https://example.com/document.pdf)');

    expect(
      await screen.findByRole('document', { name: 'PDF document' })
    ).toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('does not allow a raw iframe', async () => {
    const { container } = await renderMarkdown(
      '<iframe src="https://example.com/document.pdf"></iframe>'
    );

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('document', { name: 'PDF document' })
    ).not.toBeInTheDocument();
  });

  it('does not render an unsafe raw PDF custom element', async () => {
    const { container } = await renderMarkdown(
      '<pdf-embed data-src="javascript:alert(1)"></pdf-embed>'
    );

    expect(container.querySelector('iframe')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('document', { name: 'PDF document' })
    ).not.toBeInTheDocument();
  });
});

describe('Markdown code blocks', () => {
  it('renders a copy button on fenced code blocks', async () => {
    await renderMarkdown('```cpp\nint main() {}\n```');

    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();
  });

  it('does not add a copy button to inline code', async () => {
    await renderMarkdown('Use `printf` here.');

    expect(
      screen.queryByRole('button', { name: 'Copy' })
    ).not.toBeInTheDocument();
  });
});

describe('Markdown code block line numbers', () => {
  it('renders a line number per code line', async () => {
    const { container } = await renderMarkdown('```cpp\nint a;\nint b;\n```');

    const lines = container.querySelectorAll('.code-line');
    expect(lines).toHaveLength(2);
    // Chromium reports the counter() expression rather than the resolved
    // number; its presence means each line renders its own counter value.
    for (const line of lines) {
      expect(getComputedStyle(line, '::before').content).toBe(
        'counter(code-line)'
      );
      expect(getComputedStyle(line, '::before').display).toBe('inline-block');
    }
  });

  it('does not number fenced blocks without a language', async () => {
    const { container } = await renderMarkdown('```\nalpha\nbeta\n```');

    expect(container.querySelectorAll('.code-line')).toHaveLength(0);
    expect(container.querySelector('pre')).toHaveTextContent('alpha');
  });

  it('does not number plain text or unknown languages', async () => {
    const { container } = await renderMarkdown(
      '```text\nalpha\nbeta\n```\n\n```notalanguage\nint a;\n```'
    );

    expect(container.querySelectorAll('.code-line')).toHaveLength(0);
    const blocks = container.querySelectorAll('pre');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toHaveTextContent('alpha');
    expect(blocks[1]).toHaveTextContent('int a;');
  });

  it('numbers every language flagged with line-numbers', async () => {
    const { container } = await renderMarkdown(
      '```text|line-numbers\nalpha\nbeta\n```'
    );

    expect(container.querySelectorAll('.code-line')).toHaveLength(2);
    expect(container.querySelector('pre')).toHaveTextContent('alpha');
  });

  it('omits numbers for a no-line-numbers language but still highlights', async () => {
    const { container } = await renderMarkdown(
      '```cpp|no-line-numbers\nint a;\n```'
    );

    expect(container.querySelectorAll('.code-line')).toHaveLength(0);
    expect(container.querySelector('.pl-k')).not.toBeNull();
    expect(container.querySelector('pre')).toHaveTextContent('int a;');
  });

  it('copies the original code without the line numbers', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await renderMarkdown('```cpp\nint a;\nint b;\n```');
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('int a;\nint b;\n');
  });

  it('keeps the divider aligned when numbers grow wider', async () => {
    const source = '```cpp\n' + 'int a;\n'.repeat(1000) + '```';
    const { container } = await renderMarkdown(source);

    const lines = container.querySelectorAll('.code-line');
    expect(lines).toHaveLength(1000);
    const gutterWidths = new Set(
      [...lines].map((line) => getComputedStyle(line, '::before').width)
    );

    expect(gutterWidths.size).toBe(1);
  });

  it('pads the number evenly on both sides of the divider', async () => {
    const { container } = await renderMarkdownDocument(
      '```cpp\nint a;\nint b;\n```'
    );

    const gutter = getComputedStyle(
      container.querySelector('.code-line')!,
      '::before'
    );

    expect(gutter.paddingLeft).toBe(gutter.paddingRight);
    expect(parseFloat(gutter.paddingLeft)).toBeGreaterThan(0);
  });

  it('extends the divider to the top and bottom edges of the block', async () => {
    const { container } = await renderMarkdown('```cpp\nint a;\nint b;\n```');
    const pre = container.querySelector('pre')!;

    const divider = getComputedStyle(pre, '::after');
    const gutterWidth = parseFloat(
      getComputedStyle(container.querySelector('.code-line')!, '::before').width
    );

    expect(divider.position).toBe('absolute');
    expect(divider.top).toBe('0px');
    expect(divider.bottom).toBe('0px');
    expect(parseFloat(divider.left)).toBeCloseTo(gutterWidth, 1);
  });

  it('leaves the outer horizontal inset around numbered code blocks to the container', async () => {
    const { container } = await renderMarkdownDocument('```cpp\nint a;\n```');

    const pre = getComputedStyle(container.querySelector('pre')!);
    expect(pre.paddingLeft).toBe('0px');
    expect(parseFloat(pre.paddingRight)).toBeGreaterThan(0);
  });

  it('keeps the prose inset for code blocks without line numbers', async () => {
    const { container } = await renderMarkdownDocument(
      '```cpp|no-line-numbers\nint a;\n```'
    );

    const pre = getComputedStyle(container.querySelector('pre')!);
    expect(parseFloat(pre.paddingLeft)).toBeGreaterThan(0);
  });

  it('widens the gutter to fit the largest line number', async () => {
    const block = (lineCount: number) =>
      '```cpp\n' +
      Array.from({ length: lineCount }, (_, index) => `int v${index};`).join(
        '\n'
      ) +
      '\n```';

    const { container: singleDigits } = await renderMarkdown(block(9));
    const { container: doubleDigits } = await renderMarkdown(block(10));

    const gutterWidth = (container: HTMLElement) =>
      parseFloat(
        getComputedStyle(container.querySelector('.code-line')!, '::before')
          .width
      );

    expect(gutterWidth(doubleDigits)).toBeGreaterThan(
      gutterWidth(singleDigits)
    );
  });
});

describe('Markdown containers', () => {
  it('keeps multiline inline code literal inside a container', async () => {
    const { container } = await renderMarkdownDocument(
      ':::info\n\n`example\n:::warning\n:::\nend`\n\nTail\n\n:::'
    );
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Tail');
    expect(container.querySelector('code')).toHaveTextContent(
      'example :::warning ::: end'
    );
    expect(
      screen.queryByRole('button', { name: 'Copy' })
    ).not.toBeInTheDocument();
  });

  it('reveals formulas on repeated opens of nested titled containers', async () => {
    const user = userEvent.setup();
    const { container } = await renderMarkdownDocument(
      ':::info[Outer $a$]\n\n:::warning[Inner $b$]\n\nLiteral \\$x\\$ and $y^2$\n\n:::\n\n:::'
    );
    const outer = screen.getByRole('button');
    expect(outer.querySelector('.katex-html')).toHaveTextContent('a');
    await user.click(outer);
    const inner = screen.getAllByRole('button')[1];
    expect(inner.querySelector('.katex-html')).toHaveTextContent('b');
    expect(screen.queryByText(/Literal/)).not.toBeInTheDocument();
    await user.click(inner);
    expect(screen.getByText(/Literal/)).toBeVisible();
    expect(screen.getByText(/Literal/)).toHaveTextContent('Literal $x$ and');
    expect(container.querySelectorAll('.katex-html')).toHaveLength(3);
    await user.click(outer);
    expect(container.querySelectorAll('.katex-html')).toHaveLength(1);
    await user.click(outer);
    await user.click(screen.getAllByRole('button')[1]);
    const formulas = container.querySelectorAll('.katex-html');
    expect(formulas).toHaveLength(3);
    expect(formulas[2]).toBeVisible();
    expect(formulas[2]).toHaveTextContent('y2');
  });

  it('shows HTML-like alert title text literally alongside its formula', async () => {
    const { container } = await renderMarkdownDocument(
      ':::info[<img src=x onerror=alert(1)> $x$]\nBody\n:::'
    );
    const title = screen.getByRole('button');
    expect(title).toBeVisible();
    expect(title).toHaveTextContent('<img src=x onerror=alert(1)>');
    expect(title.querySelector('.katex-html')).toHaveTextContent('x');
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('renders paired samples as literal payloads and copies their original text', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const input = '$x$ <img src=x> & 50% 中文\n  last  ';
    const output = String.raw`\(y\)`;
    const { container } = await renderMarkdownDocument(
      `:::info[Sample]{open}\n\n\`\`\`input1\n${input}\n\`\`\`\n\n\`\`\`output1\n${output}\n\`\`\`\n\n:::`
    );
    expect(
      screen.getByRole('heading', { name: 'Sample 1 input' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Sample 1 output' })
    ).toBeVisible();
    const blocks = container.querySelectorAll('pre');
    expect(blocks).toHaveLength(2);
    expect(blocks[0].textContent).toBe(input);
    expect(blocks[1].textContent).toBe(output);
    expect(container.querySelector('.katex')).not.toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    expect(writeText).toHaveBeenCalledWith(input);
  });

  it('renders formulas in an alert title while leaving its other text literal', async () => {
    const { container } = await renderMarkdownDocument(
      ':::info[**Literal** $x^2$]\nBody\n:::'
    );
    const title = screen.getByRole('button');
    expect(title).toHaveTextContent('**Literal**');
    expect(title.querySelector('.katex-html')).toHaveTextContent('x2');
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('$x^2$');
  });

  it('does not allow source HTML to supply an unsanitized alert title', async () => {
    const { container } = await renderMarkdownDocument(
      '<md-alert data-title="Safe" data-title-html="<img src=x onerror=alert(1)>">Body</md-alert>'
    );
    expect(screen.getByRole('button', { name: 'Safe' })).toBeVisible();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('applies the same PDF, sample, and math extensions inside nested containers', async () => {
    const { container } = await renderMarkdownDocument(
      ':::info\n:::warning\n@[pdf](/document.pdf)\n:::\n\n```input1\n3\n```\n\n```output1\n6\n```\n\n$x^2$\n:::'
    );
    expect(
      screen.getByRole('document', { name: 'PDF document' })
    ).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
    expect(screen.getByText('6')).toBeVisible();
    expect(container.querySelector('.katex-html')).toHaveTextContent('x2');
    expect(container).not.toHaveTextContent(':::');
  });

  it('collapses a titled container until the title is clicked', async () => {
    const user = userEvent.setup();
    await renderMarkdown(':::info[Heads up]\nPay **attention**.\n:::');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('border-blue-200');
    expect(alert).toHaveClass('not-prose');
    const toggle = screen.getByRole('button', { name: 'Heads up' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('attention')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('attention').tagName).toBe('STRONG');
  });

  it.each([
    ['{opened}', 'true'],
    ['{closed}', 'false'],
    ['{open}', 'true'],
    ['{close}', 'false'],
  ] as const)(
    'renders a titled container with a %s marker with aria-expanded %s',
    async (marker, expanded) => {
      await renderMarkdown(`:::info[Heads up]${marker}\nPay attention.\n:::`);

      expect(screen.getByRole('button', { name: 'Heads up' })).toHaveAttribute(
        'aria-expanded',
        expanded
      );
      if (expanded === 'true') {
        expect(screen.getByText('Pay attention.')).toBeInTheDocument();
      } else {
        expect(screen.queryByText('Pay attention.')).not.toBeInTheDocument();
      }
    }
  );

  it.each([
    ['info', 'border-blue-200'],
    ['warning', 'border-yellow-200'],
    ['success', 'border-green-200'],
    ['error', 'border-red-200'],
  ] as const)(
    'renders the %s variant styling',
    async (variant, borderClass) => {
      await renderMarkdown(`:::${variant}\nMessage body\n:::`);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(borderClass);
      expect(alert).toHaveTextContent('Message body');
    }
  );

  it('renders a container written across separate paragraphs', async () => {
    await renderMarkdown(':::warning\n\nWatch **out**\n\n:::');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Watch');
    expect(screen.getByText('out').tagName).toBe('STRONG');
  });

  it('renders a container that directly follows text without a blank line', async () => {
    await renderMarkdown('Intro line\n:::info\nbody\n:::\nTail line');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('body');
    expect(screen.getByText('Intro line')).toBeInTheDocument();
    expect(screen.getByText('Tail line')).toBeInTheDocument();
  });

  it('renders a container that follows text inside a blockquote', async () => {
    await renderMarkdown('> intro\n> :::info\n> body\n> :::\n> tail');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('body');
    expect(screen.getByText('intro')).toBeInTheDocument();
    expect(screen.getByText('tail')).toBeInTheDocument();
  });

  it('renders an align container with the requested alignment', async () => {
    const { container } = await renderMarkdown(':::align{right}\nhello\n:::');

    expect(container.querySelector('.text-right')).toHaveTextContent('hello');
  });

  it('centers an image inside a center align container', async () => {
    const { container } = await renderMarkdown(
      ':::align{center}\n![pic](https://example.com/pic.png)\n:::'
    );

    const align = container.querySelector('.text-center')!;
    const img = container.querySelector('img')!;
    const alignBox = align.getBoundingClientRect();
    const imgBox = img.getBoundingClientRect();

    // Tailwind's preflight makes images block-level, so text-align alone
    // leaves them at the left edge; auto margins must equalize both gaps.
    expect(imgBox.left - alignBox.left).toBeCloseTo(
      alignBox.right - imgBox.right,
      0
    );
  });

  it('aligns an image to the right in a right align container', async () => {
    const { container } = await renderMarkdown(
      ':::align{right}\n![pic](https://example.com/pic.png)\n:::'
    );

    const align = container.querySelector('.text-right')!;
    const img = container.querySelector('img')!;
    const alignBox = align.getBoundingClientRect();
    const imgBox = img.getBoundingClientRect();

    expect(alignBox.right - imgBox.right).toBeLessThan(1);
  });

  it('renders nested containers', async () => {
    const user = userEvent.setup();
    await renderMarkdown(':::info[Outer]\n:::warning\ninner\n:::\n:::');

    // The titled outer container starts collapsed, hiding the inner one.
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Outer' }));

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveClass('border-blue-200');
    expect(alerts[0]).toHaveTextContent('Outer');
    expect(alerts[1]).toHaveClass('border-yellow-200');
    expect(alerts[1]).toHaveTextContent('inner');
    expect(alerts[0]).toContainElement(alerts[1]);
  });

  it('renders completed inner containers when the outer one is unterminated', async () => {
    await renderMarkdown(':::info\n\n:::warning\ninner\n:::\n');

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveClass('border-yellow-200');
    expect(screen.getByText(/:::info/)).toBeInTheDocument();
  });

  it('renders sibling containers one after another', async () => {
    await renderMarkdown(':::info\na\n:::\n\n:::error\nb\n:::');

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveClass('border-blue-200');
    expect(alerts[1]).toHaveClass('border-red-200');
  });

  it('keeps an unterminated container as plain text', async () => {
    await renderMarkdown(':::info\nnever closed');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(/:::info/)).toBeInTheDocument();
  });

  it('keeps the tail of an expanded container that follows another one', async () => {
    await renderMarkdown(
      ':::error\nINJECTED\n:::\n\n:::info\nppppppppppppppppppppp\n\n:::'
    );

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toHaveTextContent('INJECTED');
    expect(alerts[1]).toHaveTextContent('ppppppppppppppppppppp');
    expect(alerts[1]).not.toHaveTextContent('INJECTED');
    expect(alerts[1].querySelector('[role="alert"]')).toBeNull();
  });

  it('renders a container inside a blockquote', async () => {
    await renderMarkdown('> :::info\n> hi\n> :::');

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('hi');
  });

  it('renders nested containers inside a blockquote', async () => {
    await renderMarkdown('> :::info\n> :::warning\n> inner\n> :::\n> :::');

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toContainElement(alerts[1]);
    expect(alerts[1]).toHaveTextContent('inner');
  });

  it('renders wrappers collected by an unterminated container', async () => {
    await renderMarkdown(':::info\n\n> :::warning\n> hi\n> :::');

    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toHaveTextContent('hi');
    expect(screen.getByText(/:::info/)).toBeInTheDocument();
  });

  it('re-parses compact bodies inside nested list items', async () => {
    const { container } = await renderMarkdown('  - :::info\n    hi\n    :::');

    expect(screen.getByRole('alert')).toHaveTextContent('hi');
    expect(container.querySelector('pre')).toBeNull();
  });

  it('renders a list inside a container', async () => {
    await renderMarkdown(':::info\n- a\n- b\n\n:::');

    const alert = screen.getByRole('alert');
    expect(alert.querySelector('ul')).not.toBeNull();
    expect(alert).toHaveTextContent('a');
    expect(alert).toHaveTextContent('b');
  });
});

describe('Markdown resolved file URLs', () => {
  it('renders resolved attachment links and images through the sanitized pipeline', async () => {
    const source = resolveFileUrls(
      '[download](file://asset.zip)\n\n![image](file://image.jpg)',
      {
        baseUrl: '/api/p/42/file',
        filenames: ['asset.zip', 'image.jpg'],
      }
    );

    await renderMarkdown(source);

    expect(screen.getByRole('link', { name: 'download' })).toHaveAttribute(
      'href',
      '/api/p/42/file/asset.zip'
    );
    expect(screen.getByRole('img', { name: 'image' })).toHaveAttribute(
      'src',
      '/api/p/42/file/image.jpg'
    );
  });
});
