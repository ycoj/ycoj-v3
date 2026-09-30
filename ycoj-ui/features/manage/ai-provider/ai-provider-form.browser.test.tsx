import '@/app/globals.css';
import AiProviderForm from './ai-provider-form';
import messages from '@/messages/en';
import zhMessages from '@/messages/zh';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { AiProviderConfig } from '@/shared/types/ai-provider';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';

const mocks = vi.hoisted(() => ({ save: vi.fn(), success: vi.fn() }));
vi.mock('@/api/client/method', () => ({
  default: { AiProvider: { saveAiProviderConfig: mocks.save } },
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));

function fixture(): AiProviderConfig {
  return {
    version: 1,
    providers: [
      {
        id: 'provider-1',
        name: 'OpenAI',
        apiType: 'openai-responses',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        models: [
          {
            id: 'model-1',
            name: 'First model',
            model: 'first-model',
            reasoning: true,
            thinkingLevel: 'high',
            contextTokens: 128000,
            maxTokens: 32000,
          },
          {
            id: 'model-2',
            name: 'Second model',
            model: 'second-model',
            reasoning: false,
            thinkingLevel: 'off',
            contextTokens: 64000,
            maxTokens: 16000,
          },
        ],
      },
    ],
    dataGeneration: { providerId: 'provider-1', modelId: 'model-1' },
    htmlToMarkdown: { providerId: 'provider-1', modelId: 'model-1' },
  };
}

function renderForm(config = fixture(), locale = 'en') {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'zh' ? zhMessages : messages}
    >
      <AiProviderForm config={config} />
    </NextIntlClientProvider>
  );
}

async function choose(
  label: string,
  option: string,
  container: Pick<typeof screen, 'findByRole'> = screen
) {
  await userEvent.click(
    await container.findByRole('combobox', { name: label })
  );
  await userEvent.click(await screen.findByRole('option', { name: option }));
  await waitFor(() =>
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  );
}

describe('AI provider settings', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.save.mockReturnValue({
      send: () => Promise.resolve({ url: '/manage/ai-provider' }),
    });
  });

  it('edits provider and model settings while preserving IDs and blank saved keys', async () => {
    renderForm();
    fireEvent.change(screen.getByLabelText('Provider name'), {
      target: { value: 'Custom AI' },
    });
    fireEvent.change(screen.getByLabelText('Base URL'), {
      target: { value: 'https://ai.example/v1' },
    });
    await choose('API type', 'OpenAI Chat Completions compatible');
    const model = within(screen.getByRole('region', { name: 'First model' }));
    fireEvent.change(model.getByLabelText('API model ID'), {
      target: { value: 'custom-model' },
    });
    fireEvent.change(model.getByLabelText('Display name'), {
      target: { value: 'Custom model' },
    });
    await choose('Reasoning support', 'Not supported', model);
    await choose('Default thinking level', 'Maximum', model);
    fireEvent.change(model.getByLabelText('Context window'), {
      target: { value: '200000' },
    });
    fireEvent.change(model.getByLabelText('Maximum output tokens'), {
      target: { value: '64000' },
    });
    await choose(
      'HTML to Markdown conversion model',
      'Custom AI / Second model'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 1,
        dataGeneration: { providerId: 'provider-1', modelId: 'model-1' },
        htmlToMarkdown: { providerId: 'provider-1', modelId: 'model-2' },
        providers: [
          expect.objectContaining({
            id: 'provider-1',
            name: 'Custom AI',
            apiType: 'openai-completions',
            baseUrl: 'https://ai.example/v1',
            apiKey: '',
            models: [
              expect.objectContaining({
                id: 'model-1',
                name: 'Custom model',
                model: 'custom-model',
                reasoning: false,
                thinkingLevel: 'max',
                contextTokens: 200000,
                maxTokens: 64000,
              }),
              expect.objectContaining({ id: 'model-2' }),
            ],
          }),
        ],
      })
    );
  });

  it('requires saving replacement defaults before a previous default model can be removed', async () => {
    renderForm();
    expect(
      screen.getByRole('button', { name: 'Remove model First model' })
    ).toBeDisabled();
    await choose('AI data generation model', 'OpenAI / Second model');
    await choose('HTML to Markdown conversion model', 'OpenAI / Second model');
    expect(
      screen.getByRole('button', { name: 'Remove model First model' })
    ).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Remove model First model' })
      ).toBeEnabled()
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove model First model' })
    );
    expect(
      screen.queryByRole('region', { name: 'First model' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove model Second model' })
    ).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[1][0].providers[0].models).toHaveLength(1);
    expect(mocks.save.mock.calls[1][0].providers[0].models[0].id).toBe(
      'model-2'
    );
  });

  it('adds and removes providers and models without losing neighboring edits', async () => {
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Add provider' }));
    fireEvent.change(screen.getAllByLabelText('Provider name')[1], {
      target: { value: 'Second provider' },
    });
    fireEvent.change(screen.getAllByLabelText('API key')[1], {
      target: { value: 'new-key' },
    });
    fireEvent.change(screen.getAllByLabelText('API model ID')[2], {
      target: { value: 'new-api-model' },
    });
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add model' })[1]
    );
    expect(screen.getAllByLabelText('API model ID')).toHaveLength(4);
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Remove model New model' })[1]
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add provider' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove provider New provider' })
    );
    expect(screen.getAllByLabelText('Provider name')).toHaveLength(2);
    expect(screen.getAllByLabelText('API model ID')[2]).toHaveValue(
      'new-api-model'
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0].providers[1]).toMatchObject({
      name: 'Second provider',
      apiKey: 'new-key',
      models: [expect.objectContaining({ model: 'new-api-model' })],
    });
    expect(screen.getAllByLabelText('API key')[1]).toHaveValue('');
  });

  it('retains edits on a backend failure and disables editing during a save', async () => {
    let resolve!: (value: unknown) => void;
    mocks.save.mockReturnValue({
      send: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    renderForm();
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'replacement-key' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    );
    expect(screen.getByLabelText('Provider name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add provider' })).toBeDisabled();
    resolve({
      error: { message: 'An active AI generation still uses this model.' },
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'An active AI generation still uses this model.'
      )
    );
    expect(screen.getByLabelText('API key')).toHaveValue('replacement-key');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('does not report success or clear edits when sudo confirmation is required', async () => {
    mocks.save.mockReturnValue({
      send: () => Promise.resolve({ url: '/user/sudo' }),
    });
    renderForm();
    fireEvent.change(screen.getByLabelText('API key'), {
      target: { value: 'replacement-key' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByLabelText('API key')).toHaveValue('replacement-key');
  });

  it('shows field validation without sending invalid token limits', async () => {
    renderForm();
    fireEvent.change(screen.getAllByLabelText('Maximum output tokens')[0], {
      target: { value: '200000' },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText(
        'Maximum output cannot exceed the context window.'
      )
    ).toBeVisible();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('initializes both defaults when adding a provider to an empty registry', async () => {
    renderForm({ version: 1, providers: [] });
    expect(screen.getByText('No AI providers')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add provider' }));
    expect(
      screen.getByRole('combobox', { name: 'AI data generation model' })
    ).toHaveTextContent('New provider / New model');
    expect(
      screen.getByRole('combobox', {
        name: 'HTML to Markdown conversion model',
      })
    ).toHaveTextContent('New provider / New model');
  });

  it('renders Chinese settings labels', () => {
    renderForm(fixture(), 'zh');
    expect(screen.getByRole('heading', { name: 'AI 提供商' })).toBeVisible();
    expect(screen.getByLabelText('提供商名称')).toHaveValue('OpenAI');
    expect(screen.getByRole('button', { name: '保存更改' })).toBeEnabled();
  });

  it.each([390, 1280])(
    'keeps fields and actions within the settings column at %spx',
    async (width) => {
      await page.viewport(width, 3000);
      const config = fixture();
      config.providers[0].name =
        'A provider with a long display name for responsive settings';
      render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <div className="p-6">
            <TwoColumnLayout
              ratio="8-2"
              gap="gap-6"
              left={<AiProviderForm config={config} />}
              right={<aside>System management</aside>}
            />
          </div>
        </NextIntlClientProvider>
      );
      const form = screen.getByRole('form', { name: 'AI providers' });
      await waitFor(() => {
        const bounds = form.getBoundingClientRect();
        for (const element of within(form)
          .getAllByRole('combobox')
          .concat(within(form).getAllByRole('textbox'))) {
          const rect = element.getBoundingClientRect();
          expect(rect.width).toBeGreaterThan(100);
          expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
          expect(rect.right).toBeLessThanOrEqual(bounds.right + 1);
        }
        expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
      });
      await page.screenshot({
        element: form,
        path: `../../../test-results/ai-provider-${width}.png`,
      });
      await page.viewport(1280, 900);
    }
  );
});
