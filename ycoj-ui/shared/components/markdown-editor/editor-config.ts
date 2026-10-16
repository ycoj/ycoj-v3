import { parseChartOptions } from './parse-chart-options';
import { config, XSSPlugin } from 'md-editor-rt';

config({
  markdownItConfig(markdown) {
    markdown.use(XSSPlugin, {});
  },
  editorExtensions: {
    echarts: {
      js: 'https://unpkg.com/echarts@6.1.0/dist/echarts.min.js',
      parseOption: parseChartOptions,
    },
  },
});
