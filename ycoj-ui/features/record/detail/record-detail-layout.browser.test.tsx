import '@/app/globals.css';
import RecordDetailLive from './record-detail-live';
import en from '@/messages/en';
import zh from '@/messages/zh';
import type { ProblemDoc } from '@/shared/types/problem';
import type { RecordDoc } from '@/shared/types/record';
import type { User } from '@/shared/types/user';
import { act, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

vi.mock('@/shared/hooks/use-record-socket', () => ({
  useRecordSocket: () => ({ reconnect: vi.fn() }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const longCode = [
  '#include <iostream>',
  `// ${'A long source line to check horizontal scrolling. '.repeat(20)}`,
  'int main() {',
  ...Array.from({ length: 120 }, (_, i) => `  std::cout << ${i} << "\\n";`),
  '  return 0;',
  '}',
].join('\n');

const record: RecordDoc = {
  _id: '66ab1234567890abcdef1234',
  domainId: 'system',
  pid: 1000,
  uid: 2,
  lang: 'cc.cc17',
  code: longCode,
  score: 80,
  memory: 1024 * 1024,
  time: 25,
  judgeTexts: [],
  compilerTexts: ['main.cpp:1: warning: unused variable'],
  testCases: Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    subtaskId: 0,
    score: i === 7 ? 0 : 10,
    time: 25,
    memory: 1024,
    status: i === 7 ? 2 : 1,
    message: i === 7 ? 'Read 120, expected 119.' : '',
  })),
  rejudged: false,
  judger: 0,
  judgeAt: '2026-11-16T08:00:00Z',
  status: 2,
};

function mount(rdoc = record, locale: 'en' | 'zh' = 'en', sidebar = true) {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : zh}
      timeZone="UTC"
    >
      <main className="mx-auto max-w-7xl p-4">
        <p className="text-muted-foreground mb-4 text-xs">
          Layout preview · synthetic submission
        </p>
        <RecordDetailLive
          rdoc={rdoc}
          pdoc={{ docId: 1000, title: 'A + B Problem' } as ProblemDoc}
          udoc={{ _id: 2, uname: 'student', avatar: '' } as User}
          languages={{}}
          allowRejudge={sidebar}
          allRevs={{}}
        />
      </main>
    </NextIntlClientProvider>
  );
}

afterEach(async () => {
  document.documentElement.classList.remove('dark');
  await act(async () => {
    await page.viewport(1280, 900);
  });
});

describe('record detail layout', () => {
  for (const { width, height, locale, dark } of [
    { width: 1280, height: 900, locale: 'en', dark: false },
    { width: 390, height: 844, locale: 'zh', dark: false },
    { width: 1280, height: 900, locale: 'zh', dark: true },
  ] as const) {
    it(`keeps feedback ahead of long code at ${width}px in ${locale}${dark ? ' dark mode' : ''}`, async () => {
      await page.viewport(width, height);
      document.documentElement.classList.toggle('dark', dark);
      const messages = locale === 'en' ? en.record : zh.record;
      mount(record, locale);

      const source = screen.getByRole('region', { name: messages.sourceCode });
      const compiler = screen.getByRole('heading', {
        name: messages.compilerOutput,
      });
      const testcases = screen.getByRole('heading', {
        name: messages.testcaseDetails,
      });
      const sourceTitle = screen.getByRole('heading', {
        name: messages.sourceCode,
      });
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: messages.expandCode })
        ).toBeVisible();
        expect(source.clientHeight).toBeGreaterThan(0);
      });

      expect(compiler.getBoundingClientRect().bottom).toBeLessThan(
        testcases.getBoundingClientRect().top
      );
      expect(testcases.getBoundingClientRect().bottom).toBeLessThan(
        sourceTitle.getBoundingClientRect().top
      );
      expect(testcases.getBoundingClientRect().top).toBeLessThan(height);
      expect(source.clientHeight).toBeLessThanOrEqual(
        Math.min(512, height * 0.6) + 1
      );
      expect(source.scrollHeight).toBeGreaterThan(source.clientHeight);
      expect(source.scrollWidth).toBeGreaterThan(source.clientWidth);
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      for (const id of ['#1', '#8']) {
        const box = screen.getByText(id).getBoundingClientRect();
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(width);
        expect(box.bottom).toBeLessThan(
          sourceTitle.getBoundingClientRect().top
        );
      }

      await page.screenshot({
        path: `../../../test-results/record-detail-${width}-${dark ? 'dark' : 'light'}.png`,
        element: screen.getByRole('main'),
      });

      const feedbackTop =
        testcases.getBoundingClientRect().top + window.scrollY;
      const collapsedHeight = source.clientHeight;
      await act(async () => {
        await page.getByRole('button', { name: messages.expandCode }).click();
      });
      expect(source.clientHeight).toBeGreaterThan(collapsedHeight);
      expect(source.clientHeight).toBeGreaterThanOrEqual(
        source.scrollHeight - 1
      );
      expect(testcases.getBoundingClientRect().top + window.scrollY).toBe(
        feedbackTop
      );

      await act(async () => {
        await page.getByRole('button', { name: messages.collapseCode }).click();
      });
      expect(source.clientHeight).toBe(collapsedHeight);
      expect(testcases.getBoundingClientRect().top + window.scrollY).toBe(
        feedbackTop
      );
    });
  }

  it('keeps short code compact and the final line reachable by scrolling', async () => {
    const { unmount } = mount({
      ...record,
      code: 'int main() {}',
      compilerTexts: [],
      testCases: [],
    });
    const shortSource = screen.getByRole('region', { name: 'Source code' });
    expect(shortSource.clientHeight).toBeLessThan(100);
    expect(screen.queryByRole('button', { name: 'Expand all' })).toBeNull();
    unmount();

    mount(record, 'en', false);
    const source = screen.getByRole('region', { name: 'Source code' });
    source.scrollTop = source.scrollHeight;
    expect(source.scrollTop).toBeGreaterThan(0);
    const lastLine = screen.getByText('return', { exact: true });
    const box = lastLine.getBoundingClientRect();
    const viewport = source.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(viewport.top);
    expect(box.bottom).toBeLessThanOrEqual(viewport.bottom);
  });

  it('shows a shared heading for subtasks and exposes failure details on focus', async () => {
    mount({
      ...record,
      testCases: record.testCases.map((testcase, i) => ({
        ...testcase,
        subtaskId: i < 4 ? 1 : 2,
      })),
    });
    expect(
      screen.getByRole('heading', { name: 'Testcase details' })
    ).toBeVisible();
    expect(screen.getByText('Subtask 1')).toBeVisible();
    expect(screen.getByText('Subtask 2')).toBeVisible();
    const failedCase = screen
      .getByText('#8')
      .closest<HTMLElement>('[tabindex]');
    expect(failedCase).not.toBeNull();
    await act(async () => failedCase!.focus());
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Read 120, expected 119.'
    );
  });
});
