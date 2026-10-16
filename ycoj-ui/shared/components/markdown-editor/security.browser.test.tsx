import './editor-config';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { config, MdEditor } from 'md-editor-rt';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const setOption = vi.fn();

config({
  editorExtensions: {
    echarts: {
      instance: {
        init: () => ({ setOption, resize: vi.fn(), dispose: vi.fn() }),
      },
    },
  },
});

function renderPreview(value: string, onError = vi.fn()) {
  return render(
    <MdEditor
      value={value}
      onError={onError}
      toolbars={[]}
      footers={[]}
      noPrettier
      noHighlight
      noKatex
      noMermaid
      noImgZoomIn
    />
  );
}

describe('Markdown editor content security', () => {
  beforeEach(() => {
    setOption.mockClear();
  });

  it('renders ordinary formatting while removing executable HTML', () => {
    renderPreview(
      '<strong>Safe formatting</strong>\n\n' +
        '<img alt="Untrusted image" ' +
        "onmouseover=\"this.insertAdjacentHTML('afterend', '<p>Injected script ran</p>')\">"
    );

    expect(screen.getByText('Safe formatting')).toBeVisible();
    const image = screen.getByRole('img', { name: 'Untrusted image' });
    fireEvent.mouseOver(image);

    expect(image).not.toHaveAttribute('onmouseover');
    expect(screen.queryByText('Injected script ran')).not.toBeInTheDocument();
  });

  it('rejects chart code without executing it', async () => {
    const onError = vi.fn();
    renderPreview(
      '```echarts\n' +
        '(() => { document.body.insertAdjacentHTML("beforeend", ' +
        '"<p>Injected chart ran</p>"); return {}; })()\n' +
        '```',
      onError
    );

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(setOption).not.toHaveBeenCalled();
    expect(screen.queryByText('Injected chart ran')).not.toBeInTheDocument();
  });

  it('continues to render charts expressed as JSON', async () => {
    const option = {
      xAxis: { type: 'category', data: ['A', 'B'] },
      yAxis: {},
      series: [{ type: 'bar', data: [1, 2] }],
    };
    renderPreview('```echarts\n' + JSON.stringify(option) + '\n```');

    await waitFor(() =>
      expect(setOption).toHaveBeenCalledWith({
        ...option,
        tooltip: { renderMode: 'richText' },
      })
    );
  });
});
