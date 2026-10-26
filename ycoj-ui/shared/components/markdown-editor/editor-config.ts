import { parseChartOptions } from './parse-chart-options';
import { createFormulaHost } from '@/shared/components/markdown/formula-host';
import { toHtml } from 'hast-util-to-html';
import { config, XSSPlugin } from 'md-editor-rt';

config({
  markdownItConfig(markdown) {
    markdown.use(XSSPlugin, {});
  },
  editorExtensions: {
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
      js: 'https://unpkg.com/echarts@6.1.0/dist/echarts.min.js',
      parseOption: parseChartOptions,
    },
  },
});
