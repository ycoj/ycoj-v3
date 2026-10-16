import { parseChartOptions } from './parse-chart-options';
import { describe, expect, it } from 'vitest';

describe('Untrusted chart options', () => {
  it('forces text tooltips for defaults, series, and individual data points', () => {
    const tooltip = {
      renderMode: 'html',
      formatter: '<img src=x onerror="alert(1)">',
    };
    const data = { value: 1, tooltip };
    const options = parseChartOptions(
      JSON.stringify({
        tooltip: [tooltip],
        series: [{ tooltip, data: [data] }],
      })
    );

    expect(options).toEqual({
      tooltip: [{ ...tooltip, renderMode: 'richText' }],
      series: [
        {
          tooltip: { ...tooltip, renderMode: 'richText' },
          data: [{ ...data, tooltip: { ...tooltip, renderMode: 'richText' } }],
        },
      ],
    });
  });

  it.each([
    { title: { link: 'javascript:alert(1)' } },
    { title: { sublink: 'javascript:alert(1)' } },
    {
      toolbox: {
        feature: { dataView: { lang: ['<img src=x onerror=alert(1)>'] } },
      },
    },
  ])('rejects chart HTML and navigation options: %j', (option) => {
    expect(() => parseChartOptions(JSON.stringify(option))).toThrow();
  });

  it.each(['null', '[]', 'true', '"chart"', '{"__proto__":{"trust":true}}'])(
    'rejects invalid chart objects: %s',
    (input) => {
      expect(() => parseChartOptions(input)).toThrow();
    }
  );

  it('preserves disabled tooltips and ordinary chart data', () => {
    expect(
      parseChartOptions(
        '{"tooltip":false,"series":[{"type":"bar","data":[1,2]}]}'
      )
    ).toEqual({
      tooltip: { show: false, renderMode: 'richText' },
      series: [{ type: 'bar', data: [1, 2] }],
    });
  });

  it('sets the tooltip default inside a timeline base option', () => {
    const series = [{ type: 'bar', data: [1, 2] }];
    expect(
      parseChartOptions(JSON.stringify({ baseOption: { series } }))
    ).toEqual({
      baseOption: { series, tooltip: { renderMode: 'richText' } },
      tooltip: { renderMode: 'richText' },
    });
  });
});
