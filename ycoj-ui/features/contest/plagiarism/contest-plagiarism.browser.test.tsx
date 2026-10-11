import '@/app/globals.css';
import ContestPlagiarism from './contest-plagiarism';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import ContestManagementClient from '@/features/contest/management/contest-management-client';
import messages from '@/messages/en';
import messagesZh from '@/messages/zh';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { Contest } from '@/shared/types/contest';
import type {
  PlagiarismJob,
  PlagiarismReport,
  PlagiarismSource,
} from '@/shared/types/contest-plagiarism';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { cdp, page } from 'vitest/browser';

const mocks = vi.hoisted(() => ({
  latest: vi.fn(),
  start: vi.fn(),
  poll: vi.fn(),
  source: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Contest: {
      getContestPlagiarism: (...args: unknown[]) => ({
        send: () => mocks.latest(...args),
      }),
      startContestPlagiarism: (...args: unknown[]) => ({
        send: () => mocks.start(...args),
      }),
      getContestPlagiarismJob: (...args: unknown[]) => ({
        send: () => mocks.poll(...args),
      }),
      getContestPlagiarismSource: (...args: unknown[]) => ({
        send: () => mocks.source(...args),
      }),
    },
  },
}));

const contest: Contest = {
  _id: 'contest',
  docId: 'contest',
  domainId: 'system',
  docType: 30,
  title: 'Autumn contest',
  content: '',
  owner: 1,
  rule: 'oi',
  beginAt: new Date('2026-01-01T00:00:00Z'),
  endAt: new Date('2026-01-01T02:00:00Z'),
  duration: 2,
  attend: 3,
  pids: [1, 2],
};

const submission = (rid: string, uid: number) => ({
  rid,
  uid,
  language: 'cc.cc17o2',
  submittedAt: '2026-01-01T01:00:00Z',
  tokenCount: 120,
});
const report: PlagiarismReport = {
  version: '1',
  generatedAt: '2026-01-01T02:01:00Z',
  elapsedMs: 400,
  participantCount: 3,
  submissionCount: 4,
  comparedPairs: 2,
  users: {
    1: { _id: 1, uname: 'Alice' },
    2: { _id: 2, uname: 'Bob' },
    3: { _id: 3, uname: 'Charlie' },
  },
  skippedSubmissions: [],
  problems: [
    {
      pid: 1,
      title: 'Range sums',
      participantCount: 2,
      submissionCount: 2,
      comparedPairs: 1,
    },
    {
      pid: 2,
      title: 'Shortest paths',
      participantCount: 2,
      submissionCount: 2,
      comparedPairs: 1,
    },
  ],
  pairs: [
    {
      pid: 1,
      left: submission('alice-range', 1),
      right: submission('bob-range', 2),
      similarity: 94,
      scores: { token: 95, structure: 90, fingerprint: 94 },
      matches: [
        {
          leftStartLine: 2,
          leftEndLine: 5,
          rightStartLine: 3,
          rightEndLine: 6,
          tokenCount: 40,
        },
      ],
      warnings: [],
    },
    {
      pid: 2,
      left: submission('alice-path', 1),
      right: submission('charlie-path', 3),
      similarity: 40,
      scores: { token: 30, structure: 40, fingerprint: 15 },
      matches: [],
      warnings: [],
    },
  ],
};

const completed: PlagiarismJob = {
  jobId: 'job',
  status: 'completed',
  createdAt: '2026-01-01T02:00:00Z',
  result: report,
};

function source(rid: string): PlagiarismSource {
  return {
    rid,
    uid: rid.startsWith('alice') ? 1 : rid.startsWith('bob') ? 2 : 3,
    pid: rid.endsWith('range') ? 1 : 2,
    language: 'cc.cc17o2',
    code: rid.endsWith('range')
      ? [
          '#include <iostream>',
          'int main() {',
          '  int count; std::cin >> count;',
          '  long long total = 0;',
          '  while (count--) { int value; std::cin >> value; total += value; }',
          '  std::cout << total;',
          '}',
        ].join('\n')
      : 'int main() { return 0; }',
  };
}

function mount(tdoc = contest, locale: 'en' | 'zh' = 'en', layout = false) {
  const view = <ContestPlagiarism tid="contest" contest={tdoc} />;
  return render(
    <NextIntlClientProvider
      locale={locale}
      timeZone="Asia/Shanghai"
      messages={locale === 'en' ? messages : messagesZh}
    >
      {layout ? (
        <main className="mx-auto max-w-7xl p-4 sm:p-6">
          <TwoColumnLayout
            ratio="8-2"
            left={view}
            right={
              <aside className="text-sm text-muted-foreground">
                Contest management
              </aside>
            }
          />
        </main>
      ) : (
        view
      )}
    </NextIntlClientProvider>
  );
}

beforeAll(async () => {
  const inter = new FontFace(
    'Inter',
    `url("${new URL('../../../public/fonts/Inter[opsz,wght].ttf', import.meta.url).href}")`
  );
  const mono = new FontFace(
    'Geist Mono',
    `url("${new URL('../../../public/fonts/GeistMono[wght].ttf', import.meta.url).href}")`
  );
  await Promise.all([inter.load(), mono.load()]);
  document.fonts.add(inter);
  document.fonts.add(mono);
  document.documentElement.style.setProperty(
    '--font-sans',
    'Inter, sans-serif'
  );
  document.body.style.setProperty('--font-geist-mono', 'Geist Mono, monospace');
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.latest.mockResolvedValue({ tdoc: contest, job: null });
  mocks.source.mockImplementation((_tid: string, _jobId: string, rid: string) =>
    Promise.resolve(source(rid))
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe('contest plagiarism check', () => {
  for (const method of ['tree-sitter', 'heuristic'] as const) {
    it(`runs the selected ${method} method and shows the stored method after reload`, async () => {
      const name = messages.contestManagement.plagiarism.methods[method];
      const stored = { ...completed, method, result: { ...report, method } };
      mocks.start.mockResolvedValue(stored);
      const view = mount();
      const run = await screen.findByRole('button', {
        name: 'Run plagiarism check',
      });
      await waitFor(() => expect(run).toBeEnabled());
      const select = screen.getByRole('combobox', {
        name: 'Comparison method',
      });
      expect(select).toHaveTextContent('Tree-sitter syntax analysis');
      if (method === 'heuristic') {
        await userEvent.click(select);
        await userEvent.click(screen.getByRole('option', { name }));
      }
      await userEvent.click(run);
      expect(mocks.start).toHaveBeenCalledWith('contest', method);
      await screen.findByRole('heading', { name: 'Similarity report' });
      expect(
        screen
          .getAllByText(`Method used: ${name}`)
          .every((element) => element.checkVisibility())
      ).toBe(true);
      view.unmount();
      mocks.latest.mockResolvedValue({ tdoc: contest, job: stored });
      mount();
      await screen.findByRole('heading', { name: 'Similarity report' });
      expect(
        screen.getByRole('combobox', { name: 'Comparison method' })
      ).toHaveTextContent(name);
    });
  }

  it('locks the method selector while an existing job is active', async () => {
    mocks.latest.mockResolvedValue({
      tdoc: contest,
      job: {
        ...completed,
        status: 'running',
        result: undefined,
        method: 'heuristic',
      },
    });
    mount();
    await screen.findByText('Comparing submissions');
    const select = screen.getByRole('combobox', { name: 'Comparison method' });
    expect(select).toHaveTextContent('Heuristic tokenization');
    expect(select).toBeDisabled();
  });

  for (const outcome of ['success', 'failure'] as const) {
    it(`ignores a stale start ${outcome} after switching contests`, async () => {
      let settle: () => void = () => {};
      mocks.start.mockImplementationOnce(
        () =>
          new Promise<PlagiarismJob>((resolve, reject) => {
            settle = () =>
              outcome === 'success'
                ? resolve(completed)
                : reject(new Error('Old contest failure'));
          })
      );
      const view = mount();
      const run = await screen.findByRole('button', {
        name: 'Run plagiarism check',
      });
      await waitFor(() => expect(run).toBeEnabled());
      await userEvent.click(run);
      view.rerender(
        <NextIntlClientProvider
          locale="en"
          timeZone="Asia/Shanghai"
          messages={messages}
        >
          <ContestPlagiarism tid="next-contest" contest={contest} />
        </NextIntlClientProvider>
      );
      await waitFor(() =>
        expect(
          screen.getByRole('button', { name: 'Run plagiarism check' })
        ).toBeEnabled()
      );
      await act(async () => settle());
      expect(
        screen.queryByRole('heading', { name: 'Similarity report' })
      ).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Run plagiarism check' })
      ).toBeEnabled();
    });
  }

  it('clears the old report and applies the end gate when switching contests', async () => {
    mocks.latest.mockResolvedValue({ tdoc: contest, job: completed });
    const data: ContestManagementResponse = {
      tdoc: contest,
      tsdoc: null,
      owner_udoc: { _id: 1, uname: 'Owner', avatar: '', mail: '' },
      pdict: {},
      files: [],
      privateFiles: [],
    };
    const view = render(
      <NextIntlClientProvider
        locale="en"
        timeZone="Asia/Shanghai"
        messages={messages}
      >
        <ContestManagementClient mode="plagiarism" tid="contest" data={data} />
      </NextIntlClientProvider>
    );
    await screen.findByRole('heading', { name: 'Similarity report' });
    const nextContest = {
      ...contest,
      _id: 'future',
      endAt: new Date(Date.now() + 60_000),
    };
    view.rerender(
      <NextIntlClientProvider
        locale="en"
        timeZone="Asia/Shanghai"
        messages={messages}
      >
        <ContestManagementClient
          mode="plagiarism"
          tid="future"
          data={{ ...data, tdoc: nextContest }}
        />
      </NextIntlClientProvider>
    );
    expect(
      screen.queryByRole('heading', { name: 'Similarity report' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Run plagiarism check' })
    ).toBeDisabled();
    expect(mocks.latest).toHaveBeenCalledOnce();
  });
  it('does not fetch or start a check before the contest ends', async () => {
    mount({ ...contest, endAt: new Date(Date.now() + 60_000) });
    expect(
      screen.getByRole('button', { name: 'Run plagiarism check' })
    ).toBeDisabled();
    expect(screen.getByText(/Available after the contest ends/)).toBeVisible();
    expect(mocks.latest).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('queues a check, polls its progress, and shows the completed report', async () => {
    mocks.start.mockResolvedValue({
      ...completed,
      status: 'pending',
      result: undefined,
      progress: { completedPairs: 0, totalPairs: 2 },
    });
    mocks.poll
      .mockResolvedValueOnce({
        ...completed,
        status: 'running',
        result: undefined,
        progress: { completedPairs: 1, totalPairs: 2 },
      })
      .mockResolvedValue(completed);
    mount();
    await screen.findByText(
      'No plagiarism check has been run for this contest.'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Run plagiarism check' })
    );
    expect(await screen.findByText('Check queued')).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Run check again' })
    ).toBeDisabled();
    expect(
      await screen.findByText('Comparing submissions', {}, { timeout: 2500 })
    ).toBeVisible();
    expect(screen.getByText('1 of 2 pairs compared')).toBeVisible();
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Similarity report' },
        { timeout: 2500 }
      )
    ).toBeVisible();
    expect(mocks.poll).toHaveBeenCalledWith('contest', 'job');
    expect(
      screen.getByRole('button', { name: 'Run check again' })
    ).toBeEnabled();
    expect(screen.getByText(/not proof of plagiarism/)).toBeVisible();
  });

  it('resumes an active check after reloading and reconnects after a polling failure', async () => {
    mocks.latest.mockResolvedValue({
      tdoc: contest,
      job: { ...completed, status: 'running', result: undefined },
    });
    mocks.poll
      .mockRejectedValueOnce(new Error('Connection interrupted'))
      .mockResolvedValue(completed);
    mount();
    expect(await screen.findByText('Comparing submissions')).toBeVisible();
    expect(
      await screen.findByRole('alert', {}, { timeout: 2500 })
    ).toHaveTextContent('Connection interrupted');
    await userEvent.click(screen.getByRole('button', { name: 'Reload check' }));
    expect(
      await screen.findByRole(
        'heading',
        { name: 'Similarity report' },
        { timeout: 2500 }
      )
    ).toBeVisible();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it('retains a failed start explanation and allows retrying', async () => {
    mocks.start
      .mockResolvedValueOnce({ error: { message: 'Permission denied' } })
      .mockResolvedValue(completed);
    mount();
    await screen.findByText(
      'No plagiarism check has been run for this contest.'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Run plagiarism check' })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Permission denied'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Run plagiarism check' })
    );
    expect(
      await screen.findByRole('heading', { name: 'Similarity report' })
    ).toBeVisible();
  });

  it('loads both scoped sources on selection, marks matches, and filters comparisons', async () => {
    mocks.latest.mockResolvedValue({ tdoc: contest, job: completed });
    mount();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Compare Alice and Bob for Range sums',
      })
    );
    const left = await screen.findByRole('region', { name: 'Code by Alice' });
    const right = screen.getByRole('region', { name: 'Code by Bob' });
    expect(left).toHaveTextContent('long long total = 0;');
    expect(right).toHaveTextContent('long long total = 0;');
    expect(
      within(left).getByLabelText('Line 2, matching fragment')
    ).toBeVisible();
    expect(
      within(right).getByLabelText('Line 3, matching fragment')
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', { name: 'Left 2–5 · Right 3–6' })
    );
    expect(
      screen.getByRole('button', { name: 'Left 2–5 · Right 3–6' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(mocks.source).toHaveBeenCalledWith('contest', 'job', 'alice-range');
    expect(mocks.source).toHaveBeenCalledWith('contest', 'job', 'bob-range');
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Minimum similarity' })
    );
    await userEvent.click(
      screen.getByRole('option', { name: '70% and above' })
    );
    expect(
      screen.queryByRole('button', {
        name: 'Compare Alice and Charlie for Shortest paths',
      })
    ).not.toBeInTheDocument();
    expect(screen.getByText('1 pair shown')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Code by Alice' })
    ).not.toBeInTheDocument();
  });

  it('shows source errors and ignores a stale selection response', async () => {
    let resolveSource!: (value: PlagiarismSource) => void;
    mocks.latest.mockResolvedValue({ tdoc: contest, job: completed });
    mocks.source.mockImplementation(
      (_tid: string, _jobId: string, rid: string) =>
        rid.endsWith('range')
          ? new Promise<PlagiarismSource>((resolve) => {
              resolveSource = resolve;
            })
          : Promise.resolve(source(rid))
    );
    mount();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Compare Alice and Bob for Range sums',
      })
    );
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Compare Alice and Charlie for Shortest paths',
      })
    );
    expect(
      await screen.findByRole('region', { name: 'Code by Charlie' })
    ).toHaveTextContent('return 0;');
    await act(async () => {
      resolveSource(source('bob-range'));
    });
    expect(
      screen.queryByRole('region', { name: 'Code by Bob' })
    ).not.toBeInTheDocument();
    mocks.source.mockRejectedValueOnce(new Error('Source unavailable'));
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Compare Alice and Bob for Range sums',
      })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Source unavailable'
    );
    mocks.source.mockImplementation(
      (_tid: string, _jobId: string, rid: string) =>
        Promise.resolve(source(rid))
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Retry loading sources' })
    );
    expect(
      await screen.findByRole('region', { name: 'Code by Bob' })
    ).toBeVisible();
  });

  it('jumps both long source panes on every activation of the same matching fragment', async () => {
    const match = {
      leftStartLine: 100,
      leftEndLine: 104,
      rightStartLine: 120,
      rightEndLine: 124,
      tokenCount: 40,
    };
    mocks.latest.mockResolvedValue({
      tdoc: contest,
      job: {
        ...completed,
        result: {
          ...report,
          pairs: [{ ...report.pairs[0], matches: [match] }],
        },
      },
    });
    mocks.source.mockImplementation(
      (_tid: string, _jobId: string, rid: string) =>
        Promise.resolve({
          ...source(rid),
          code: Array.from(
            { length: 200 },
            (_, index) => `int value${index} = ${index};`
          ).join('\n'),
        })
    );
    mount();
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Compare Alice and Bob for Range sums',
      })
    );
    await screen.findByRole('region', { name: 'Code by Alice' });
    for (let activation = 0; activation < 2; activation += 1) {
      await userEvent.click(
        screen.getByRole('button', { name: 'Left 100–104 · Right 120–124' })
      );
      for (const [name, line] of [
        ['Alice', 100],
        ['Bob', 120],
      ] as const) {
        const pane = screen.getByRole('region', { name: `Code by ${name}` });
        const lineElement = within(pane).getByLabelText(
          `Line ${line}, matching fragment`
        );
        await waitFor(() => {
          const bounds = pane.getBoundingClientRect();
          const target = lineElement.getBoundingClientRect();
          expect(target.top).toBeGreaterThanOrEqual(bounds.top - 1);
          expect(target.bottom).toBeLessThanOrEqual(bounds.bottom);
        });
        pane.scrollTop = 0;
      }
    }
  });

  it('moves keyboard focus to source evidence beyond a large comparison table and returns to the selected pair', async () => {
    await page.viewport(1280, 900);
    const pairs = Array.from({ length: 760 }, (_, index) => ({
      ...report.pairs[0],
      left: { ...report.pairs[0].left, rid: `alice-range-${index}` },
      right: { ...report.pairs[0].right, rid: `bob-range-${index}` },
    }));
    mocks.latest.mockResolvedValue({
      tdoc: contest,
      job: {
        ...completed,
        result: { ...report, comparedPairs: pairs.length, pairs },
      },
    });
    mount();
    const pairButton = (
      await screen.findAllByRole('button', {
        name: 'Compare Alice and Bob for Range sums',
      })
    )[0];
    pairButton.focus();
    await userEvent.keyboard('{Enter}');
    const heading = await screen.findByRole('heading', {
      name: 'Alice and Bob · Range sums',
    });
    await waitFor(() => {
      expect(heading).toHaveFocus();
      const bounds = heading.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    });
    await userEvent.tab();
    const returnButton = screen.getByRole('button', {
      name: 'Back to selected pair',
    });
    expect(returnButton).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(pairButton).toHaveFocus();
    const pairBounds = pairButton.getBoundingClientRect();
    expect(pairBounds.top).toBeGreaterThanOrEqual(0);
    expect(pairBounds.bottom).toBeLessThanOrEqual(window.innerHeight);
    await userEvent.keyboard('{Enter}');
    expect(heading).toHaveFocus();
  });

  it('renders the Chinese report and review notice', async () => {
    mocks.latest.mockResolvedValue({
      tdoc: contest,
      job: {
        ...completed,
        result: {
          ...report,
          skippedSubmissions: [
            {
              rid: 'skipped',
              uid: 3,
              pid: 1,
              reason: 'Only C++ submissions are supported.',
            },
          ],
          pairs: [
            {
              ...report.pairs[0],
              warnings: [
                'preprocessor-not-expanded',
                'tree-sitter-parse-errors',
              ],
            },
          ],
        },
      },
    });
    mount(contest, 'zh');
    expect(
      await screen.findByRole('heading', { name: '相似度报告' })
    ).toBeVisible();
    expect(screen.getByText(/不能直接证明抄袭/)).toBeVisible();
    await userEvent.click(screen.getByText('查重范围与局限'));
    expect(screen.getByText(/仅支持 C\+\+ 提交/)).toBeVisible();
    await userEvent.click(
      screen.getByRole('button', {
        name: '比较 Alice 与 Bob 的 Range sums 源码',
      })
    );
    expect(
      screen.getByText('预处理宏按原文比较，展开后的代码可能不同。')
    ).toBeVisible();
    expect(
      screen.getByText(
        messagesZh.contestManagement.plagiarism.warnings[
          'tree-sitter-parse-errors'
        ]
      )
    ).toBeVisible();
  });

  it('localizes a failed job explanation for Chinese administrators', async () => {
    mocks.latest.mockResolvedValue({
      tdoc: contest,
      job: {
        ...completed,
        status: 'failed',
        result: undefined,
        error:
          'The plagiarism check exceeded the five-minute time limit. Please try again.',
      },
    });
    mount(contest, 'zh');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '查重超过五分钟时限，可重新查重以重试。'
    );
    expect(screen.getByRole('button', { name: '重新查重' })).toBeEnabled();
  });

  it.each([390, 1440])(
    'keeps the comparison readable at %spx and captures it',
    async (width) => {
      await cdp().send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 2400,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await page.viewport(width, 2400);
      mocks.latest.mockResolvedValue({ tdoc: contest, job: completed });
      mount(contest, 'en', true);
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Compare Alice and Bob for Range sums',
        })
      );
      await screen.findByRole('region', { name: 'Code by Alice' });
      await waitFor(() => {
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
        const left = screen
          .getByRole('region', { name: 'Code by Alice' })
          .getBoundingClientRect();
        const right = screen
          .getByRole('region', { name: 'Code by Bob' })
          .getBoundingClientRect();
        expect(left.width).toBeGreaterThan(250);
        for (const button of screen.getAllByRole('button', {
          name: /^Compare /,
        })) {
          expect(button.getBoundingClientRect().right).toBeLessThanOrEqual(
            width
          );
        }
        if (width < 1280) expect(right.top).toBeGreaterThan(left.bottom);
        else expect(Math.abs(right.top - left.top)).toBeLessThan(1);
      });
      await page.screenshot({
        element: screen.getByRole('main'),
        path: `../../../test-results/contest-plagiarism-${width}.png`,
      });
      await page.viewport(1280, 900);
      await cdp().send('Emulation.clearDeviceMetricsOverride');
    }
  );
});
