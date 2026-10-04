import '@/app/globals.css';
import AccountSettingsPage from './account-settings-page';
import { AVATAR_MAX_BYTES } from './avatar-form-utils';
import en from '@/messages/en';
import zh from '@/messages/zh';
import {
  SETTING_FLAG,
  type AccountSetting,
  type AccountSettingsData,
} from '@/shared/types/account-settings';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page as browserPage } from 'vitest/browser';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  updateAvatar: vi.fn(),
  uploadAvatar: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/api/client/method', () => ({
  default: {
    Account: {
      saveAccountSettings: mocks.save,
      updateAvatar: mocks.updateAvatar,
      uploadAvatar: mocks.uploadAvatar,
    },
  },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({
  toast: { success: mocks.success, error: mocks.error },
}));
vi.mock('@/shared/components/markdown-editor', async () => {
  const { forwardRef } = await import('react');
  return {
    default: forwardRef<HTMLTextAreaElement, ComponentProps<'textarea'>>(
      function Editor(props, ref) {
        return <textarea {...props} ref={ref} data-testid="markdown-editor" />;
      }
    ),
  };
});

const setting = (
  key: string,
  overrides: Partial<AccountSetting> = {}
): AccountSetting => ({
  key,
  name: key,
  family: 'setting_info',
  type: 'text',
  value: '',
  flag: 0,
  ...overrides,
});
const data: AccountSettingsData = {
  category: 'account',
  current: {
    _id: 2,
    uname: 'alice',
    mail: 'alice@example.com',
    avatar: 'github:alice',
    qq: '12345',
    gender: 0,
    bio: '# Hello',
    school: 'My school',
    phone: '123',
    hideRank: false,
    notes: 'Some notes',
    count: 0,
    enabled: false,
    'plugin.active': true,
  },
  settings: [
    setting('avatar'),
    setting('qq'),
    setting('gender', {
      type: 'select',
      value: 2,
      range: { '0': 'Boy', '1': 'Girl', '2': 'Other' },
    }),
    setting('bio', { type: 'markdown' }),
    setting('school'),
    setting('phone', { flag: SETTING_FLAG.DISABLED }),
    setting('hideRank', { type: 'boolean', value: false }),
    setting('secret', { flag: SETTING_FLAG.SECRET }),
    setting('hidden', { flag: SETTING_FLAG.HIDDEN }),
    setting('storage', { family: 'setting_storage' }),
    setting('notes', {
      type: 'textarea',
      name: 'Plugin notes',
      family: 'Plugin',
      desc: 'Plugin help',
    }),
    setting('count', { type: 'number', value: 99, family: 'Plugin' }),
    setting('enabled', { type: 'boolean', value: true, family: 'Plugin' }),
    setting('plugin.active', { type: 'boolean', family: 'Plugin' }),
    setting('emptyChoice', {
      type: 'select',
      range: [
        ['', 'None'],
        ['x', 'Extra'],
      ],
      family: 'Plugin',
    }),
  ],
};

function page(nextData = data, locale: 'en' | 'zh' = 'en') {
  return (
    <NextIntlClientProvider
      locale={locale}
      messages={locale === 'en' ? en : zh}
    >
      <AccountSettingsPage data={nextData} />
    </NextIntlClientProvider>
  );
}

async function chooseSelect(label: string, option: string) {
  fireEvent.keyDown(screen.getByRole('combobox', { name: label }), {
    key: 'ArrowDown',
  });
  await userEvent.click(await screen.findByRole('option', { name: option }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  const success = () => ({
    send: vi.fn().mockResolvedValue({ url: '/home/settings/account' }),
  });
  mocks.save.mockImplementation(success);
  mocks.updateAvatar.mockImplementation(success);
  mocks.uploadAvatar.mockImplementation(success);
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('account settings fields', () => {
  it('uses the full page width with a separate settings sidebar and flat form sections', () => {
    const { container } = render(page());
    expect(container.firstElementChild).toHaveClass('w-full');
    expect(container.firstElementChild).not.toHaveClass('max-w-3xl');
    const sidebar = screen.getByRole('complementary');
    const nav = within(sidebar).getByRole('navigation', { name: 'Settings' });
    expect(
      within(nav).getByRole('link', { name: 'Account settings' })
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(nav).getByRole('link', { name: 'Account settings' })
    ).toHaveAttribute('href', '/home/settings/account');
    expect(
      screen.getByRole('region', { name: 'Personal information' })
    ).not.toHaveClass('border');
    expect(
      screen.getByRole('heading', { name: 'Avatar' }).closest('section')
    ).not.toHaveClass('border');
  });

  it('keeps short fields aligned while giving the editor and avatar controls room', () => {
    const { container } = render(page());
    expect(container.querySelector('[data-slot="avatar"]')).not.toHaveClass(
      'sm:mt-6'
    );
    expect(
      screen.getByLabelText('QQ').closest('[data-slot="field"]')
    ).toHaveClass('xl:col-span-2');
    expect(
      screen.getByLabelText('School').closest('[data-slot="field"]')
    ).toHaveClass('sm:col-span-3');
    const editor = screen.getByTestId('markdown-editor');
    expect(editor).toHaveClass('h-56!', 'min-h-0!');
    expect(editor.closest('[data-slot="field"]')).toHaveClass('sm:col-span-6');
    expect(screen.getByRole('form', { name: 'Avatar' })).toHaveClass(
      'grid',
      'max-w-2xl',
      '2xl:grid-cols-[8rem_minmax(0,1fr)_auto]'
    );
  });

  it('separates section headings from field labels and aligns actions below the content', () => {
    render(page());
    const section = screen.getByRole('region', {
      name: 'Personal information',
    });
    expect(section).toHaveClass(
      'border-t',
      'xl:grid-cols-[8rem_minmax(0,1fr)]'
    );
    expect(
      within(section).getByRole('heading', {
        name: 'Personal information',
        level: 2,
      })
    ).toHaveClass('font-semibold');
    expect(
      within(section).queryByText(
        'Your contact details, school and introduction.'
      )
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Choose an avatar service or upload an image.')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Personalize the appearance of your profile.')
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save changes' }).parentElement
    ).toHaveClass('justify-end');
  });

  it('groups visible fields, initializes each control, and disables protected values', () => {
    render(page());
    expect(
      screen.getByRole('region', { name: 'Personal information' })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Plugin' })).getByLabelText(
        'Plugin notes'
      )
    ).toHaveValue('Some notes');
    expect(screen.queryByLabelText('hidden')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('storage')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Phone')).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Gender' })).toHaveTextContent(
      'Male'
    );
    expect(screen.getByTestId('markdown-editor')).toHaveValue('# Hello');
    expect(screen.getByLabelText('count')).toHaveValue(0);
    expect(screen.getByRole('checkbox', { name: 'enabled' })).not.toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'plugin.active' })
    ).toBeChecked();
    expect(
      screen.getByRole('combobox', { name: 'emptyChoice' })
    ).toHaveTextContent('None');
    expect(screen.getByLabelText('secret')).toHaveValue('');
    expect(screen.getByText('Plugin help')).toBeInTheDocument();
  });

  it('saves edited fields with true/false, shows success and refreshes in place', async () => {
    render(page());
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText('School'));
    await user.type(screen.getByLabelText('School'), 'New school');
    await user.click(screen.getByRole('checkbox', { name: 'enabled' }));
    await user.click(screen.getByRole('checkbox', { name: 'plugin.active' }));
    await chooseSelect('Gender', 'Female');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith('Account settings saved.')
    );
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        school: 'New school',
        gender: '1',
        enabled: true,
        'plugin.active': false,
      })
    );
    expect(mocks.save.mock.calls[0][0]).not.toHaveProperty('avatar');
    expect(mocks.save.mock.calls[0][0]).not.toHaveProperty('phone');
    expect(mocks.save.mock.calls[0][0]).not.toHaveProperty('secret');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it.each(['backend', 'network'])(
    'preserves edits and displays a %s save failure',
    async (failure) => {
      mocks.save.mockReturnValue({
        send:
          failure === 'backend'
            ? vi.fn().mockResolvedValue({
                error: { name: 'ValidationError', message: 'Invalid school' },
              })
            : vi.fn().mockRejectedValue(new Error('Invalid school')),
      });
      render(page());
      fireEvent.change(screen.getByLabelText('School'), {
        target: { value: 'Draft school' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() =>
        expect(mocks.error).toHaveBeenCalledWith('Invalid school')
      );
      expect(screen.getByLabelText('School')).toHaveValue('Draft school');
      expect(mocks.refresh).not.toHaveBeenCalled();
      expect(mocks.success).not.toHaveBeenCalled();
    }
  );

  it('retains dirty profile fields across an avatar refresh and updates clean values', async () => {
    const view = render(page());
    fireEvent.change(screen.getByLabelText('School'), {
      target: { value: 'Unsaved school' },
    });
    view.rerender(
      page({
        ...data,
        current: { ...data.current, avatar: 'qq:12345', qq: '67890' },
      })
    );
    await waitFor(() =>
      expect(screen.getByLabelText('QQ')).toHaveValue('67890')
    );
    expect(screen.getByLabelText('School')).toHaveValue('Unsaved school');
  });

  it('uses Chinese built-in copy while leaving plugin labels intact', () => {
    render(page(data, 'zh'));
    expect(
      screen.getByRole('heading', { name: '账户设置' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('学校')).toHaveValue('My school');
    expect(screen.getByLabelText('Plugin notes')).toHaveValue('Some notes');
  });

  it('lets an administrator opt out of the leaderboard and explains that RP is unaffected', async () => {
    render(page());
    const optOut = screen.getByRole('checkbox', {
      name: 'Hide from leaderboard',
    });
    expect(optOut).not.toBeChecked();
    expect(
      screen.getByText(
        'Your name will not appear on the leaderboard, but your RP is still calculated normally.'
      )
    ).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(optOut);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ hideRank: true })
    );
  });

  it.each([390, 1280])(
    'keeps boolean controls square before and after checking them at %spx',
    async (width) => {
      await browserPage.viewport(width, 1600);
      render(page());
      const checkbox = screen.getByRole('checkbox', {
        name: 'Hide from leaderboard',
      });
      for (const checked of [false, true]) {
        if (checked) await userEvent.click(checkbox);
        const bounds = checkbox.getBoundingClientRect();
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.width).toBeCloseTo(bounds.height);
        expect(bounds.width).toBeLessThanOrEqual(24);
      }
      await browserPage.screenshot({
        element: screen.getByRole('region', { name: 'Personal information' }),
        path: `../../../test-results/account-settings-${width}.png`,
      });
      await browserPage.viewport(1280, 900);
    }
  );

  it('omits leaderboard visibility from the form and save when the server excludes it', async () => {
    render(
      page({
        ...data,
        settings: data.settings.filter((setting) => setting.key !== 'hideRank'),
      })
    );
    expect(
      screen.queryByRole('checkbox', { name: 'Hide from leaderboard' })
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save.mock.calls[0][0]).not.toHaveProperty('hideRank');
  });

  it('reflects an existing leaderboard opt-out and can be turned back off', async () => {
    render(
      page({
        ...data,
        current: { ...data.current, hideRank: true },
      })
    );
    const optOut = screen.getByRole('checkbox', {
      name: 'Hide from leaderboard',
    });
    expect(optOut).toBeChecked();

    await userEvent.setup().click(optOut);
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalled());
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ hideRank: false })
    );
  });
});

describe('avatar settings', () => {
  it('switches provider inputs and placeholders and updates provider avatars', async () => {
    render(page());
    expect(
      screen.getByPlaceholderText('Enter your GitHub username')
    ).toHaveValue('alice');
    await chooseSelect('Avatar source', 'Gravatar');
    expect(
      screen.getByPlaceholderText('Email registered with Gravatar')
    ).toHaveAttribute('type', 'email');
    await chooseSelect('Avatar source', 'QQ');
    fireEvent.change(screen.getByPlaceholderText('Enter your QQ number'), {
      target: { value: '12345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update avatar' }));
    await waitFor(() =>
      expect(mocks.updateAvatar).toHaveBeenCalledWith('qq', '12345')
    );
    expect(mocks.success).toHaveBeenCalledWith('Avatar updated.');
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it.each(['size', 'extension'])(
    'rejects invalid upload %s without sending',
    async (kind) => {
      render(page());
      await chooseSelect('Avatar source', 'Upload');
      const input = screen.getByLabelText('Avatar image');
      expect(input).toHaveAttribute('accept', '.jpg,.jpeg,.png');
      const file = new File(
        ['image'],
        kind === 'extension' ? 'avatar.gif' : 'avatar.png',
        { type: 'image/png' }
      );
      if (kind === 'size')
        Object.defineProperty(file, 'size', { value: AVATAR_MAX_BYTES + 1 });
      fireEvent.change(input, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: 'Update avatar' }));
      expect(
        await screen.findByText(
          kind === 'size'
            ? 'The image must not exceed 8 MiB.'
            : 'Choose a JPG, JPEG or PNG image.'
        )
      ).toBeInTheDocument();
      expect(mocks.uploadAvatar).not.toHaveBeenCalled();
    }
  );

  it('uploads an image, refreshes and releases the temporary preview on unmount', async () => {
    const createUrl = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:avatar-preview');
    const revokeUrl = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    const view = render(page());
    await chooseSelect('Avatar source', 'Upload');
    const file = new File(['image'], 'avatar.PNG', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Avatar image'), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update avatar' }));
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith('Avatar updated.')
    );
    expect(mocks.uploadAvatar).toHaveBeenCalledWith(file);
    expect(createUrl).toHaveBeenCalledWith(file);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledWith('blob:avatar-preview');
  });

  it('imports an image URL, saves the verified local copy and refreshes', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((value) => resolve(value!), 'image/png')
    );
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(blob));
    render(page());
    await chooseSelect('Avatar source', 'Image URL');
    fireEvent.change(screen.getByLabelText('Image URL'), {
      target: { value: 'https://example.com/avatar.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update avatar' }));
    await waitFor(() => expect(mocks.uploadAvatar).toHaveBeenCalledOnce());
    const file = mocks.uploadAvatar.mock.calls[0][0] as File;
    expect(file.type).toBe('image/png');
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(mocks.updateAvatar).not.toHaveBeenCalled();
  });

  it('shows an actionable error for a GIF disguised as a PNG URL without saving', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(new Blob(['GIF89a'], { type: 'image/png' }))
    );
    render(page());
    await chooseSelect('Avatar source', 'Image URL');
    fireEvent.change(screen.getByLabelText('Image URL'), {
      target: { value: 'https://example.com/avatar.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Update avatar' }));
    expect(
      await screen.findByText(/Could not import this image/)
    ).toBeVisible();
    expect(screen.getByLabelText('Image URL')).toHaveValue(
      'https://example.com/avatar.png'
    );
    expect(mocks.uploadAvatar).not.toHaveBeenCalled();
    expect(mocks.updateAvatar).not.toHaveBeenCalled();
  });

  it('keeps avatar inputs after backend rejection', async () => {
    mocks.updateAvatar.mockReturnValue({
      send: vi.fn().mockResolvedValue({
        error: { name: 'ValidationError', message: 'Invalid avatar' },
      }),
    });
    render(page());
    fireEvent.click(screen.getByRole('button', { name: 'Update avatar' }));
    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith('Invalid avatar')
    );
    expect(screen.getByLabelText('GitHub username')).toHaveValue('alice');
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
