import { printPdfFileName, printSourceFileName } from './print-download';
import { describe, expect, it } from 'vitest';

describe('printPdfFileName', () => {
  it.each([
    ['Hello World', 'contest-7-hello-world.pdf'],
    ['YCOJ 冬季赛 2026', 'contest-7-ycoj-2026.pdf'],
    ['  CSP—J  Round 1!! ', 'contest-7-csp-j-round-1.pdf'],
    ['a___b', 'contest-7-a-b.pdf'],
    ['MiXeD CaSe 123', 'contest-7-mixed-case-123.pdf'],
  ])('sanitizes %j into a slug filename', (title, expected) => {
    expect(printPdfFileName('7', title)).toBe(expected);
  });

  it.each([[''], ['冬季赛'], ['!!!'], [' — ']])(
    'falls back to the bare contest name for %j',
    (title) => {
      expect(printPdfFileName('7', title)).toBe('contest-7.pdf');
    }
  );

  it('keeps the tid verbatim', () => {
    expect(printPdfFileName('42', 'ok')).toBe('contest-42-ok.pdf');
  });
});

describe('printSourceFileName', () => {
  it('is deterministic per contest', () => {
    expect(printSourceFileName('7')).toBe('contest-7-typst-source.zip');
  });
});
