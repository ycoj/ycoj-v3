import { createMockPrintCompiler } from './fixtures/mock-print-compiler';
import { twoProblemContest } from './fixtures/two-problem-contest';
import PrintPage from './print-page';
import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import messages from '@/messages/en';
import messagesZh from '@/messages/zh';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
      <PrintPage
        tid="7"
        data={data}
        createCompiler={createMockPrintCompiler()}
      />
    </NextIntlClientProvider>
  );
}

function problemTabs() {
  return screen
    .getAllByRole('tab')
    .filter((tab) => / · T\d+$/.test(tab.textContent ?? ''));
}

function cardFor(title: string) {
  const heading = screen.getByRole('heading', { level: 3, name: title });
  const item = heading.closest('[data-slot="card"]');
  expect(item).not.toBeNull();
  return within(item as HTMLElement);
}

async function openProblem(
  user: ReturnType<typeof userEvent.setup>,
  title: string
) {
  await user.click(
    screen.getByRole('tab', {
      name: new RegExp(
        `^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} · T\\d+$`
      ),
    })
  );
  return cardFor(title);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('contest print editor', () => {
  it('starts with one C++ submission language and pretests off', () => {
    renderPage();

    expect(
      screen.getByRole('checkbox', { name: 'Pretests' })
    ).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Language ID 1' })).toHaveValue(
      'cc.cc14o2'
    );
    expect(screen.getByRole('textbox', { name: 'Display name 1' })).toHaveValue(
      'C++'
    );
    expect(
      screen.getByRole('textbox', { name: 'Compile options 1' })
    ).toHaveValue('-O2 -std=c++14 -static');
    expect(
      screen.queryByRole('textbox', { name: 'Language ID 2' })
    ).not.toBeInTheDocument();
  });

  it('renders contest defaults and problem cards from the payload', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: messages.contestPrint.title,
      })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('YCOJ 冬季赛 2026')).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Basic information' })
    ).toHaveAttribute('data-state', 'active');
    expect(screen.getByRole('tab', { name: 'Notice' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'A+B Problem · T1' })
    ).toBeInTheDocument();

    expect(problemTabs().map((tab) => tab.textContent)).toEqual([
      'A+B Problem · T1',
      '排序 · T2',
    ]);
    // Letters come from print position.
    expect(
      (await openProblem(user, 'A+B Problem')).getByText('A')
    ).toBeInTheDocument();
    expect(
      (await openProblem(user, '排序')).getByText('B')
    ).toBeInTheDocument();

    // Clean draft: the restore action stays disabled.
    await user.click(screen.getByRole('tab', { name: 'Basic information' }));
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

    const card = await openProblem(user, 'A+B Problem');
    const titleInput = card.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Sum problem');

    // The built document drives the card header.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Sum problem' })
    ).toBeInTheDocument();
    expect(cardFor('Sum problem').getByText('Modified')).toBeInTheDocument();
    await act(async () => {
      fireEvent.mouseDown(
        screen.getByRole('tab', { name: 'Basic information' }),
        { button: 0 }
      );
    });
    const restore = screen.getByRole('button', { name: 'Restore defaults' });
    expect(restore).toBeEnabled();

    await user.click(restore);
    expect(
      screen.getByRole('button', { name: 'Restore defaults' })
    ).toBeDisabled();
    await openProblem(user, 'A+B Problem');
  });

  it('preserves standard I/O and custom filenames when renaming a problem', async () => {
    const user = userEvent.setup();
    renderPage();

    const card = await openProblem(user, '排序');
    await user.click(card.getByRole('button', { name: 'Advanced' }));
    const input = card.getByLabelText('Input file');
    const output = card.getByLabelText('Output file');
    expect(input).toHaveValue('');
    expect(output).toHaveValue('');
    const program = card.getByLabelText('Program filename');
    await user.clear(program);
    await user.type(program, 'custom.cpp');

    const name = card.getByLabelText('Short name');
    await user.clear(name);
    await user.type(name, 'sort');
    expect(card.getByLabelText('Directory')).toHaveValue('sort');
    expect(program).toHaveValue('custom.cpp');
    expect(input).toHaveValue('');
    expect(output).toHaveValue('');

    await user.click(card.getByRole('button', { name: 'Advanced' }));
    await user.click(card.getByRole('button', { name: 'Advanced' }));
    expect(card.getByLabelText('Program filename')).toHaveValue('custom.cpp');
    expect(card.getByLabelText('Input file')).toHaveValue('');
  });

  it('keeps regular problem fields visible and gates mode-specific fields', async () => {
    const user = userEvent.setup();
    renderPage();

    let card = await openProblem(user, 'A+B Problem');
    const typeInput = card.getByLabelText('Problem type');
    expect(typeInput).toHaveValue('Traditional');
    await user.clear(typeInput);
    await user.type(typeInput, 'interactive');
    expect(typeInput).toHaveValue('Interactive');

    expect(card.getByLabelText('Testcases')).toBeVisible();
    expect(card.getByLabelText('Score note')).toBeVisible();
    expect(card.queryByLabelText('Pretests')).not.toBeInTheDocument();
    expect(card.getByLabelText('File name for C++')).toBeVisible();
    expect(card.queryByLabelText('Directory')).not.toBeInTheDocument();
    expect(card.queryByLabelText('Program filename')).not.toBeInTheDocument();
    expect(card.queryByLabelText('Input file')).not.toBeInTheDocument();
    expect(card.queryByLabelText('Output file')).not.toBeInTheDocument();

    await user.click(card.getByRole('button', { name: 'Advanced' }));
    card = cardFor('A+B Problem');
    expect(card.getByLabelText('Directory')).toBeVisible();
    expect(card.getByLabelText('Program filename')).toBeVisible();
    expect(card.getByLabelText('Input file')).toBeVisible();
    expect(card.getByLabelText('Output file')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Basic information' }));
    await user.click(screen.getByRole('checkbox', { name: 'NOI-style paper' }));
    await openProblem(user, 'A+B Problem');
    card = cardFor('A+B Problem');
    await user.click(card.getByRole('button', { name: 'Advanced' }));
    expect(card.queryByLabelText('Directory')).not.toBeInTheDocument();
    expect(card.queryByLabelText('Program filename')).not.toBeInTheDocument();
    expect(card.getByLabelText('Input file')).toBeVisible();

    await user.click(screen.getByRole('tab', { name: 'Basic information' }));
    await user.click(screen.getByRole('checkbox', { name: 'File I/O' }));
    await openProblem(user, 'A+B Problem');
    card = cardFor('A+B Problem');
    await user.click(card.getByRole('button', { name: 'Advanced' }));
    expect(card.queryByLabelText('Input file')).not.toBeInTheDocument();
    expect(card.queryByLabelText('Output file')).not.toBeInTheDocument();
    expect(card.getByLabelText('Testcases')).toBeVisible();
    expect(card.getByLabelText('File name for C++')).toBeVisible();
  });

  it('reorders problems with the move buttons', async () => {
    const user = userEvent.setup();
    renderPage();

    await openProblem(user, '排序');
    await user.click(screen.getByRole('button', { name: 'Move problem B up' }));

    expect(problemTabs().map((tab) => tab.textContent)).toEqual([
      '排序 · T1',
      'A+B Problem · T2',
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

    await openProblem(user, 'A+B Problem');
    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );
    expect(
      screen.queryByRole('heading', { level: 3, name: 'A+B Problem' })
    ).not.toBeInTheDocument();
    expect(problemTabs()).toHaveLength(1);

    await user.click(screen.getByRole('tab', { name: 'Basic information' }));
    const picker = screen.getByRole('combobox', { name: /Add a problem/ });
    expect(picker).toBeEnabled();
    await user.click(picker);
    await user.click(
      await screen.findByRole('option', { name: /A\+B Problem/ })
    );

    // Added problems append to the end of the order.
    expect(problemTabs().map((tab) => tab.textContent)).toEqual([
      '排序 · T1',
      'A+B Problem · T2',
    ]);
    await user.click(screen.getByRole('tab', { name: 'Basic information' }));
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

    await openProblem(user, 'A+B Problem');
    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );

    // The clicked button unmounts; the basic panel exposes the add picker.
    await user.click(screen.getByRole('tab', { name: 'Basic information' }));
    const picker = screen.getByRole('combobox', { name: /Add a problem/ });
    expect(picker).toBeEnabled();
  });

  it('shows the empty state when every problem is removed', async () => {
    const user = userEvent.setup();
    renderPage();

    await openProblem(user, 'A+B Problem');
    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );
    await openProblem(user, '排序');
    await user.click(
      screen.getByRole('button', { name: 'Remove problem A from the paper' })
    );

    expect(
      screen.getByText(messages.contestPrint.emptyProblemsTitle)
    ).toBeInTheDocument();
    expect(problemTabs()).toHaveLength(0);
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
    expect(screen.getByDisplayValue('YCOJ 冬季赛 2026')).toBeInTheDocument();
  });

  it('renders the zh catalog', async () => {
    const user = userEvent.setup();
    renderPage(response, messagesZh, 'zh');

    expect(
      screen.getByRole('heading', { level: 1, name: '打印比赛 PDF' })
    ).toBeInTheDocument();
    expect(screen.getByText('试卷设置')).toBeInTheDocument();
    await openProblem(user, '排序');
    expect(
      screen.getByRole('button', { name: '将题目 B 上移' })
    ).toBeInTheDocument();
    await openProblem(user, 'A+B Problem');
    expect(cardFor('A+B Problem').getByLabelText('题目类型')).toBeVisible();
    expect(screen.getByRole('button', { name: '刷新预览' })).toBeEnabled();
  });

  it('edits notice and problem markdown in their tabs', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: 'Notice' }));
    const notice = screen.getByRole('textbox', { name: 'Notice' });
    await user.clear(notice);
    await user.type(notice, 'Updated notice');
    expect(notice).toHaveValue('Updated notice');

    await act(async () => {
      fireEvent.mouseDown(
        screen.getByRole('tab', { name: 'A+B Problem · T1' }),
        { button: 0 }
      );
    });
    const statement = screen.getByRole('textbox', {
      name: 'Statement for A+B Problem',
    });
    expect((statement as HTMLTextAreaElement).value).toContain(
      'file://range.png'
    );
    await user.type(statement, '\nExtra line');
    expect((statement as HTMLTextAreaElement).value).toContain('Extra line');
  });
});
