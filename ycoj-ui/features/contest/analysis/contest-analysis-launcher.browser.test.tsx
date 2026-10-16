import '@/app/globals.css';
import ContestAnalysisLauncher from './contest-analysis-launcher';
import type { ContestListResponse } from '@/api/server/method/contests/list';
import messages from '@/messages/en';
import type { ContestListProjection } from '@/shared/types/contest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  overview: vi.fn(),
  create: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: vi.fn() }),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Contest: {
      getContestAnalysisOverview: () => ({ send: () => mocks.overview() }),
      createContestAnalysis: (request: unknown) => ({
        send: () => mocks.create(request),
      }),
    },
  },
}));

function contest(
  docId: string,
  title: string,
  endAt: string,
  owner: number
): ContestListProjection {
  return {
    _id: docId,
    domainId: 'system',
    docId,
    title,
    content: '',
    owner,
    rule: 'oi',
    beginAt: new Date('2026-09-01T08:00:00Z'),
    endAt: new Date(endAt),
    pids: [1001, 1002],
    assign: [],
    maintainer: [],
    attend: 12,
    rated: false,
  };
}

const ended = contest(
  'a'.repeat(24),
  'Finished round',
  '2026-09-01T12:00:00Z',
  7
);
const running = contest(
  'b'.repeat(24),
  'Running round',
  '2999-09-01T12:00:00Z',
  7
);
const foreign = contest(
  'c'.repeat(24),
  'Other coach round',
  '2026-09-02T12:00:00Z',
  9
);

const data: ContestListResponse = {
  page: 1,
  tpcount: 1,
  qs: '',
  rule: null,
  tdocs: [ended, running, foreign],
  groups: [],
  group: null,
  q: '',
} as unknown as ContestListResponse;

function renderLauncher(canManageAll = false) {
  render(
    <NextIntlClientProvider
      locale="en"
      messages={messages}
      timeZone="Asia/Shanghai"
    >
      <ContestAnalysisLauncher
        data={data}
        uid={7}
        canManageAll={canManageAll}
        canManageOwn
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mocks.overview.mockReset();
  mocks.create.mockReset();
  mocks.push.mockReset();
  mocks.overview.mockResolvedValue({
    enabled: true,
    profiles: [
      { id: 'provider-1:model-1', label: 'OpenAI / GPT-5', model: 'gpt-5' },
    ],
    defaultProfileId: 'provider-1:model-1',
    jobs: [],
  });
  mocks.create.mockResolvedValue({ jobId: 'job-1' });
});

describe('contest analysis launcher', () => {
  it('only offers finished contests the user manages', async () => {
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: 'Select contests' }));

    expect(
      screen.getByRole('checkbox', { name: 'Select contest: Finished round' })
    ).toBeEnabled();
    expect(
      screen.getByRole('checkbox', { name: 'Select contest: Running round' })
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {
        name: 'Select contest: Other coach round',
      })
    ).toBeDisabled();
  });

  it('creates a joint analysis for the selected contests', async () => {
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: 'Select contests' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Select contest: Finished round' })
    );
    expect(screen.getByText('1 selected')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() =>
      expect(screen.getByText('Joint analysis of 1 contests')).toBeVisible()
    );
    await user.click(screen.getByRole('button', { name: 'Start analysis' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      tids: [ended.docId],
      profileId: 'provider-1:model-1',
      includeStudents: true,
      language: 'en',
    });
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/contest/analysis/job-1')
    );
  });

  it('explains when the feature is unavailable', async () => {
    mocks.overview.mockResolvedValue({
      enabled: false,
      profiles: [],
      defaultProfileId: '',
      jobs: [],
    });
    const user = userEvent.setup();
    renderLauncher();
    await user.click(screen.getByRole('button', { name: 'Select contests' }));
    await user.click(
      screen.getByRole('checkbox', { name: 'Select contest: Finished round' })
    );
    await user.click(screen.getByRole('button', { name: 'Analyze' }));
    await waitFor(() =>
      expect(
        screen.getByText(
          'AI analysis is disabled or no model is configured by an administrator.'
        )
      ).toBeVisible()
    );
    expect(
      screen.getByRole('button', { name: 'Start analysis' })
    ).toBeDisabled();
  });
});
