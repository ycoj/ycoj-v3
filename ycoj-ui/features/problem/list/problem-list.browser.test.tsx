import ProblemList from './problem-list';
import type { ProblemListResponse } from '@/api/server/method/problems/list';
import messages from '@/messages/en';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';

function makeProblem(
  overrides: Partial<ProblemListResponse['pdocs'][number]> = {}
) {
  return {
    _id: 'p'.repeat(24),
    domainId: 'system',
    docType: 10 as const,
    docId: 1000,
    pid: 'P1000',
    owner: 1,
    title: 'A + B',
    nSubmit: 10,
    nAccept: 5,
    tag: [],
    hidden: false,
    ...overrides,
  } as ProblemListResponse['pdocs'][number];
}

function makeData(pdocs: ProblemListResponse['pdocs']): ProblemListResponse {
  return {
    page: 1,
    pcount: pdocs.length,
    ppcount: 1,
    pcountRelation: 'eq',
    pdocs,
    psdict: {},
    qs: '',
  };
}

const defaultFilters = {
  q: '',
  category: [],
  difficulty: [],
  namespace: '',
  sort: 'default' as const,
  dir: 'asc' as const,
  showTags: false,
  page: 1,
};

function renderList(
  data: ProblemListResponse,
  props: Partial<ComponentProps<typeof ProblemList>> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemList
        data={data}
        showTags={false}
        filters={defaultFilters}
        domainId="system"
        canManageAll={false}
        canManageOwn={false}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

describe('ProblemList', () => {
  it('renders problem id', () => {
    const problem = makeProblem({ docId: 1000, pid: 'P1000' });
    renderList(makeData([problem]));
    expect(screen.getByText('P1000')).toBeInTheDocument();
    expect(screen.getByText('P1000').closest('td')).toHaveAttribute(
      'data-llm-text',
      'P1000'
    );
  });
});
