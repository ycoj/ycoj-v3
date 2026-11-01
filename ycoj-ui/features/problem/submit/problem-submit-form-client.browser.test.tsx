import ProblemSubmitFormClient from './problem-submit-form-client';
import type { LanguageFamily } from '@/api/server/method/ui/languages';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  submitProblem: vi.fn(),
  submitProblemFile: vi.fn(),
  send: vi.fn(),
  fileSend: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Problem: {
      submitProblem: (...args: unknown[]) => {
        mocks.submitProblem(...args);
        return { send: mocks.send };
      },
    },
  },
}));

vi.mock('@/api/client/method/problem/submit-file', () => ({
  submitProblemFile: (...args: unknown[]) => {
    mocks.submitProblemFile(...args);
    return { send: mocks.fileSend };
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const languages: Record<string, LanguageFamily> = {
  cc: {
    display: 'C++',
    versions: [{ name: 'cc', display: 'C++' }],
  },
  py: {
    display: 'Python',
    versions: [{ name: 'py.py3', display: 'Python 3' }],
  },
};

const baseProblem = {
  config: {
    type: 'default',
    count: 1,
    memoryMax: 256,
    memoryMin: 1,
    timeMax: 1000,
    timeMin: 1,
    langs: ['cc', 'py'],
  },
};

function mount(
  overrides: Partial<Parameters<typeof ProblemSubmitFormClient>[0]> = {}
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ProblemSubmitFormClient
        pid="P1000"
        problem={baseProblem}
        languages={languages}
        {...overrides}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  // Render the plain textarea instead of Monaco so the code field is a
  // normal labelled control inside the test DOM.
  window.localStorage.setItem('ycoj.submit.use-code-editor', '0');
});

describe('standalone submit form preferences', () => {
  it('selects the account preferred language and template', async () => {
    mount({ preferredLanguage: 'py.py3', codeTemplate: 'print(1)' });

    expect(screen.getByLabelText('Version')).toHaveTextContent('Python 3');
    expect(screen.getByLabelText('Code')).toHaveValue('print(1)');
  });

  it('falls back to C++ when the preference is unavailable', () => {
    mount({ preferredLanguage: 'rs.rs2021' });
    expect(screen.getByLabelText('Language')).toHaveTextContent('C++');
  });

  it('submits pasted code with the selected language', async () => {
    mocks.send.mockResolvedValue({ rid: 'r'.repeat(24) });
    mount({ tid: 'c'.repeat(24) });

    // user-event parses braces as key descriptors, so paste instead.
    await userEvent.click(screen.getByLabelText('Code'));
    await userEvent.paste('int main() {}');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(mocks.submitProblem).toHaveBeenCalledWith(
        'P1000',
        expect.objectContaining({ lang: 'cc', code: 'int main() {}' }),
        'c'.repeat(24)
      )
    );
    expect(mocks.push).toHaveBeenCalledWith(`/record/${'r'.repeat(24)}`);
  });
});

describe('answer-file problems', () => {
  it('requires a file and uploads it with the fixed language', async () => {
    mocks.fileSend.mockResolvedValue({ rid: 'a'.repeat(24) });
    mount({
      problem: {
        config: {
          type: 'submit_answer',
          count: 1,
          memoryMax: 256,
          memoryMin: 1,
          timeMax: 1000,
          timeMin: 1,
        },
      },
    });

    // No code editor and no language selectors for answer problems.
    expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Language')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(await screen.findByText('Select a file')).toBeInTheDocument();

    const file = new File(['answer'], 'answer.pdf', {
      type: 'application/pdf',
    });
    await userEvent.upload(screen.getByLabelText('Answer file'), file);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(mocks.submitProblemFile).toHaveBeenCalledWith('P1000', file, {
        lang: '_',
        tid: undefined,
      })
    );
    expect(mocks.push).toHaveBeenCalledWith(`/record/${'a'.repeat(24)}`);
  });

  it('rejects files above the answer limit before uploading', async () => {
    mount({
      problem: {
        config: {
          type: 'submit_answer',
          count: 1,
          memoryMax: 256,
          memoryMin: 1,
          timeMax: 1000,
          timeMin: 1,
        },
      },
    });

    // 128 MiB + 1 byte; allocate sparse content to keep the test fast.
    const oversized = new File([new Uint8Array(1)], 'big.zip');
    Object.defineProperty(oversized, 'size', { value: 128 * 1024 * 1024 + 1 });
    await userEvent.upload(screen.getByLabelText('Answer file'), oversized);
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText(/larger than 128 MiB/)).toBeInTheDocument();
    expect(mocks.submitProblemFile).not.toHaveBeenCalled();
  });
});
