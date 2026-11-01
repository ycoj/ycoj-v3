import '@/app/globals.css';
import ConfigEditor from './config-editor';
import messages from '@/messages/en';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  send: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
}));

vi.mock('@/api/client/method/system/config', () => ({
  saveSystemConfig: mocks.save,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));

const schema = {
  type: 'object',
  properties: {
    server: {
      type: 'object',
      properties: { name: { type: 'string' } },
    },
  },
} as const;

function renderEditor(value = 'server:\n  name: YCOJ\n') {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ConfigEditor value={value} schema={schema} />
    </NextIntlClientProvider>
  );
}

describe('Raw configuration editor', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.save.mockReturnValue({ send: mocks.send });
    mocks.send.mockResolvedValue({ url: '/manage/config' });
  });

  it('validates the draft against the schema before saving', async () => {
    renderEditor();
    const editor = screen.getByLabelText('Raw configuration');
    await userEvent.clear(editor);
    await userEvent.paste('server:\n  name: 123\n');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save configuration' })
    );
    expect(
      await screen.findByText('The configuration is invalid.')
    ).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('saves a valid draft and refreshes the page data', async () => {
    renderEditor();
    const editor = screen.getByLabelText('Raw configuration');
    await userEvent.clear(editor);
    await userEvent.paste('server:\n  name: New\n');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save configuration' })
    );
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith('server:\n  name: New\n')
    );
    expect(mocks.success).toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('keeps the save button disabled while nothing changed', () => {
    renderEditor();
    expect(
      screen.getByRole('button', { name: 'Save configuration' })
    ).toBeDisabled();
  });
});
