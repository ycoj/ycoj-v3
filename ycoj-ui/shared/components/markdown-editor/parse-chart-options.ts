type ChartOptions = Record<string, unknown>;

function textTooltip(value: unknown): ChartOptions {
  if (value === false) return { show: false, renderMode: 'richText' };
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value, renderMode: 'richText' };
  }
  return { renderMode: 'richText' };
}

function textTooltips(value: unknown): ChartOptions | ChartOptions[] {
  return Array.isArray(value) ? value.map(textTooltip) : textTooltip(value);
}

export function parseChartOptions(code: string): ChartOptions {
  const options: unknown = JSON.parse(code, (key, value: unknown) => {
    // ECharts treats these options as trusted HTML or navigation, even when
    // the surrounding chart is JSON. Stored editor content is untrusted.
    if (
      [
        'toolbox',
        'link',
        'sublink',
        '__proto__',
        'prototype',
        'constructor',
      ].includes(key)
    ) {
      throw new Error('This chart option is not allowed in Markdown.');
    }
    return key === 'tooltip' ? textTooltips(value) : value;
  });
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new Error('Chart options must be a JSON object.');
  }
  const chart = options as ChartOptions;
  const base = chart.baseOption;
  if (base && typeof base === 'object' && !Array.isArray(base)) {
    const baseOption = base as ChartOptions;
    chart.baseOption = {
      ...baseOption,
      tooltip: textTooltips(baseOption.tooltip),
    };
  }
  return { ...chart, tooltip: textTooltips(chart.tooltip) };
}
