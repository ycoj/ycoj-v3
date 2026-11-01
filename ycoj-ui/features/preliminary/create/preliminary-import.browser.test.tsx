import PreliminaryImport from './preliminary-import';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  convert: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Preliminary: {
      searchObjectiveProblems: () => ({ send: mocks.search }),
      importObjectiveProblem: (pid: string) => ({
        send: () => mocks.convert(pid),
      }),
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

function renderImport() {
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <PreliminaryImport />
    </NextIntlClientProvider>
  );
}

async function selectProblem() {
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(
    await screen.findByRole('option', { name: 'P1001 CSP-J' })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.search.mockResolvedValue({
    pdocs: [{ docId: 1001, pid: 'P1001', title: 'CSP-J' }],
  });
});

describe('objective problem conversion', () => {
  it('requires a selected problem and opens the converted draft for editing', async () => {
    mocks.convert.mockResolvedValue({
      paperId: 'paper1',
      url: '/d/system/preliminary/paper1/edit',
    });
    renderImport();
    const button = screen.getByRole('button', {
      name: messages.preliminary.convertToPaper,
    });
    expect(button).toBeDisabled();
    await selectProblem();
    await userEvent.click(button);
    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith('/preliminary/paper1/edit')
    );
    expect(mocks.convert).toHaveBeenCalledWith('1001');
  });

  it('shows conversion errors and lets the user retry without navigating', async () => {
    mocks.convert.mockResolvedValue({
      error: {
        name: 'ValidationError',
        params: ['pid', null, 'Unsupported question format'],
      },
    });
    renderImport();
    await selectProblem();
    await userEvent.click(
      screen.getByRole('button', { name: messages.preliminary.convertToPaper })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unsupported question format'
    );
    expect(
      screen.getByRole('button', { name: messages.preliminary.convertToPaper })
    ).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it('prevents repeated conversion while the request is pending', async () => {
    let resolve: (value: unknown) => void = () => {};
    mocks.convert.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      })
    );
    renderImport();
    await selectProblem();
    await userEvent.click(
      screen.getByRole('button', { name: messages.preliminary.convertToPaper })
    );
    expect(
      screen.getByRole('button', { name: messages.preliminary.importing })
    ).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    resolve({ paperId: 'paper1', url: '/preliminary/paper1/edit' });
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });
});
