import { twoProblemContest } from './fixtures/two-problem-contest';
import PrintPage from './print-page';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import messages from '@/messages/en';
import messagesZh from '@/messages/zh';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const response = twoProblemContest.response;

function renderPage(
  data: ContestManagementResponse = response,
  catalog: typeof messages = messages,
  locale = 'en'
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={catalog}>
      <PrintPage tid="7" data={data} />
    </NextIntlClientProvider>
  );
}

function problemHeadings() {
  const region = screen.getByRole('region', {
    name: messages.contestPrint.problemsTitle,
  });
  return within(region).queryAllByRole('heading', { level: 3 });
}

function cardFor(title: string) {
  const heading = screen.getByRole('heading', { level: 3, name: title });
  const item = heading.closest('li');
  expect(item).not.toBeNull();
  return within(item!);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contest print editor', () => {
  it('renders contest defaults and problem cards from the payload', () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: messages.contestPrint.title,
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('YCOJ 冬季赛 2026');

    const headings = problemHeadings();
    expect(headings.map((heading) => heading.textContent)).toEqual([
      'A+B Problem',
      '排序',
    ]);
    // Letters come from print position.
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();

    // Clean draft: the restore action stays disabled.
    expect(
      screen.getByRole('button', { name: 'Restore defaults' })
    ).toBeDisabled();
    // Nothing is addable until a problem is removed.
    expect(
      screen.getByRole('combobox', { name: /Add a problem/ })
    ).toBeDisabled();
  });

  it('edits a problem title, flags the draft dirty, and restores defaults', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Edit problem A' }));
    const card = cardFor('A+B Problem');
    const titleInput = card.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Sum problem');

    // The built document drives the card header.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Sum problem' })
    ).toBeInTheDocument();
    expect(cardFor('Sum problem').getByText('Modified')).toBeInTheDocument();
    const restore = screen.getByRole('button', { name: 'Restore defaults' });
    expect(restore).toBeEnabled();

    await user.click(restore);
    expect(
      screen.getByRole('heading', { level: 3, name: 'A+B Problem' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Restore defaults' })
    ).toBeDisabled();
  });

  it('reorders problems with the move buttons', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Move problem B up' }));

    expect(problemHeadings().map((heading) => heading.textContent)).toEqual([
      '排序',
      'A+B Problem',
    ]);
    // The moved problem now occupies position A.
    const firstCard = cardFor('排序');
    expect(firstCard.getByText('A')).toBeInTheDocument();
    // And it cannot move further up.
    expect(
      screen.getByRole('button', { name: 'Move problem A up' })
    ).toBeDisabled();
  });

  it('removes a problem and adds it back through the picker', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );
    expect(
      screen.queryByRole('heading', { level: 3, name: 'A+B Problem' })
    ).not.toBeInTheDocument();
    expect(problemHeadings()).toHaveLength(1);

    const picker = screen.getByRole('combobox', { name: /Add a problem/ });
    expect(picker).toBeEnabled();
    await user.click(picker);
    await user.click(
      await screen.findByRole('option', { name: /A\+B Problem/ })
    );

    // Added problems append to the end of the order.
    expect(problemHeadings().map((heading) => heading.textContent)).toEqual([
      '排序',
      'A+B Problem',
    ]);
    expect(
      screen.getByRole('combobox', { name: /Add a problem/ })
    ).toBeDisabled();
  });

  it('surfaces build diagnostics and dismisses the panel', async () => {
    const user = userEvent.setup();
    const data: ContestManagementResponse = {
      ...response,
      tdoc: { ...response.tdoc, pids: [1001, 1002, 9999] },
    };
    renderPage(data);

    expect(
      screen.getByText('Problem 9999 is not part of the contest payload')
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Dismiss diagnostics' })
    );
    expect(
      screen.queryByText('Problem 9999 is not part of the contest payload')
    ).not.toBeInTheDocument();
  });

  it('moves focus to the add-problem picker when its card is removed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );

    // The clicked button unmounts; focus must not fall back to <body>.
    const picker = screen.getByRole('combobox', { name: /Add a problem/ });
    await waitFor(() => expect(picker).toHaveFocus());
  });

  it('shows the empty state when every problem is removed', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );
    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );

    expect(
      screen.getByText(messages.contestPrint.emptyProblemsTitle)
    ).toBeInTheDocument();
    expect(problemHeadings()).toHaveLength(0);
  });

  it('shows the empty state when the contest has no problems', () => {
    const data: ContestManagementResponse = {
      ...response,
      tdoc: { ...response.tdoc, pids: [] },
      pdict: {},
    };
    renderPage(data);

    expect(
      screen.getByText(messages.contestPrint.emptyPdictTitle)
    ).toBeInTheDocument();
  });

  it('warns when the browser cannot compile PDFs', async () => {
    vi.stubGlobal('Worker', undefined);
    renderPage();

    expect(
      await screen.findByText(messages.contestPrint.unsupportedTitle)
    ).toBeInTheDocument();
    // The draft editor still works — only the compile path is gated.
    expect(screen.getByLabelText('Title')).toHaveValue('YCOJ 冬季赛 2026');
  });

  it('renders the zh catalog', () => {
    renderPage(response, messagesZh, 'zh');

    expect(
      screen.getByRole('heading', { level: 1, name: '打印比赛 PDF' })
    ).toBeInTheDocument();
    expect(screen.getByText('试卷设置')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '将题目 B 上移' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成 PDF' })).toBeEnabled();
  });
});
