import ProblemStatisticsContent from './problem-statistics-content';
import type { ProblemStatisticsData } from '@/api/server/method/problems/statistics';
import messages from '@/messages/en';
import type { ProblemDoc } from '@/shared/types/problem';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/problem/P1000/stat',
  useSearchParams: () => new URLSearchParams('sort=time&direction=-1'),
}));

const problem = {
  _id: 'p'.repeat(24),
  domainId: 'system',
  docType: 10,
  docId: 1000,
  pid: 'P1000',
  owner: 1,
  title: 'A + B',
  nSubmit: 5,
  nAccept: 2,
  tag: [],
  content: '',
  data: [],
  config: {
    type: 'default',
    count: 1,
    memoryMax: 256,
    memoryMin: 1,
    timeMax: 1000,
    timeMin: 1,
    langs: ['cc'],
  },
  stats: { AC: 2, WA: 2, TLE: 1, s100: 2, s0: 1 },
} as unknown as ProblemDoc;

function makeData(
  overrides: Partial<ProblemStatisticsData> = {}
): ProblemStatisticsData {
  return {
    rsdocs: [
      {
        _id: 'r'.repeat(24),
        domainId: 'system',
        pid: 1000,
        uid: 2,
        time: 12,
        memory: 1024 * 1024,
        length: 42,
        lang: 'cc',
      },
    ],
    page: 1,
    pcount: 1,
    rscount: 1,
    sort: 'time',
    direction: -1,
    pdoc: problem,
    udict: { 2: { _id: 2, uname: 'alice', mail: '', avatar: '' } },
    types: ['time', 'memory', 'length', 'date'],
    udoc: null,
    ...overrides,
  };
}

function mount(data: ProblemStatisticsData) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemStatisticsContent
        data={data}
        selection={{ sort: 'time', direction: -1, lang: '', page: 1 }}
        languages={{
          cc: { display: 'C++', versions: [{ name: 'cc', display: 'C++' }] },
        }}
      />
    </NextIntlClientProvider>
  );
}

describe('ProblemStatisticsContent', () => {
  it('renders status and score distributions plus the AC list', () => {
    mount(makeData());

    expect(
      screen.getByRole('img', { name: 'Submission status distribution' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Score distribution' })
    ).toBeInTheDocument();
    expect(screen.getAllByText('AC').length).toBeGreaterThan(0);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('12ms')).toBeInTheDocument();
    expect(screen.getByText('1MiB')).toBeInTheDocument();
    expect(screen.getByText('42 B')).toBeInTheDocument();
  });

  it('shows a placeholder when no statistics have been computed', () => {
    mount(
      makeData({
        pdoc: { ...problem, stats: undefined } as unknown as ProblemDoc,
      })
    );
    expect(
      screen.getByText('No statistics are available for this problem yet.')
    ).toBeInTheDocument();
  });

  it('shows the empty state when there are no accepted submissions', () => {
    mount(makeData({ rsdocs: [], rscount: 0 }));
    expect(
      screen.getByText('No accepted submissions to show.')
    ).toBeInTheDocument();
  });
});
