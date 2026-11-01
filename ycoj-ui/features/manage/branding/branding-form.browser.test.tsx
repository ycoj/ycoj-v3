import '@/app/globals.css';
import BrandingForm from './branding-form';
import messages from '@/messages/en';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock('@/api/client/method', () => ({
  default: { Branding: { saveBrandingConfig: mocks.save } },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));

const brand = {
  origin: 'https://school.edu',
  name: 'School OJ',
  logo: 'https://cdn.school.edu/logo.png',
};
function renderForm(brands = [brand]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <BrandingForm config={{ brands }} />
    </NextIntlClientProvider>
  );
}
beforeEach(() => vi.clearAllMocks());

describe('brand settings', () => {
  it('adds a brand, saves all fields and refreshes the current brand', async () => {
    mocks.save.mockReturnValue({
      send: () => Promise.resolve({ config: { brands: [brand] } }),
    });
    renderForm([]);
    await userEvent.click(screen.getByRole('button', { name: 'Add brand' }));
    fireEvent.change(screen.getByLabelText('Visiting origin'), {
      target: { value: brand.origin },
    });
    fireEvent.change(screen.getByLabelText('Site name'), {
      target: { value: brand.name },
    });
    fireEvent.change(screen.getByLabelText('Logo URL'), {
      target: { value: brand.logo },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Save brands' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({ brands: [brand] })
    );
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
  });
  it('reports failure without losing edits and allows removing the last brand', async () => {
    mocks.save.mockReturnValue({
      send: () => Promise.reject(new Error('Save failed')),
    });
    renderForm();
    await userEvent.click(screen.getByRole('button', { name: 'Save brands' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
    expect(screen.getByLabelText('Site name')).toHaveValue(brand.name);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove brand 1' })
    );
    expect(screen.getByText(messages.branding.empty)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Save brands' }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenLastCalledWith({ brands: [] })
    );
  });
});
