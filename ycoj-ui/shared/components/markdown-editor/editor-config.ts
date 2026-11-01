import { parseChartOptions } from './parse-chart-options';
import { createFormulaHost } from '@/shared/components/markdown/formula-host';
import { browserAssetUrl } from '@/shared/lib/browser-assets';
import { toHtml } from 'hast-util-to-html';
import { config, XSSPlugin } from 'md-editor-rt';

config({
  markdownItConfig(markdown) {
    markdown.use(XSSPlugin, {});
  },
  editorExtensions: {
    highlight: {
      js: browserAssetUrl('@highlightjs/cdn-assets', 'highlight.min.js'),
      css: Object.fromEntries(
        Object.entries({
          a11y: ['a11y-light', 'a11y-dark'],
          atom: ['atom-one-light', 'atom-one-dark'],
          github: ['github', 'github-dark'],
          gradient: ['gradient-light', 'gradient-dark'],
          kimbie: ['kimbie-light', 'kimbie-dark'],
          paraiso: ['paraiso-light', 'paraiso-dark'],
          qtcreator: ['qtcreator-light', 'qtcreator-dark'],
          stackoverflow: ['stackoverflow-light', 'stackoverflow-dark'],
        }).map(([theme, [light, dark]]) => [
          theme,
          {
            light: browserAssetUrl(
              '@highlightjs/cdn-assets',
              `styles/${light}.min.css`
            ),
            dark: browserAssetUrl(
              '@highlightjs/cdn-assets',
              `styles/${dark}.min.css`
            ),
          },
        ])
      ),
    },
    prettier: {
      standaloneJs: browserAssetUrl('prettier', 'standalone.js'),
      parserMarkdownJs: browserAssetUrl('prettier', 'plugins/markdown.js'),
    },
    cropper: {
      js: browserAssetUrl('cropperjs', 'dist/cropper.min.js'),
      css: browserAssetUrl('cropperjs', 'dist/cropper.min.css'),
    },
    screenfull: {
      js: browserAssetUrl('screenfull', 'dist/screenfull.js'),
    },
    mermaid: {
      js: browserAssetUrl('mermaid', 'dist/mermaid.min.js'),
    },
    katex: {
      // The editor expects a synchronous adapter; VelociTex renders these
      // escaped hosts asynchronously through the shared MarkdownMath boundary.
      instance: {
        renderToString(source: string, options: { displayMode?: boolean }) {
          return toHtml(
            createFormulaHost(source, options.displayMode === true)
          );
        },
      },
    },
    echarts: {
      js: browserAssetUrl('echarts', 'dist/echarts.min.js'),
      parseOption: parseChartOptions,
    },
  },
});
