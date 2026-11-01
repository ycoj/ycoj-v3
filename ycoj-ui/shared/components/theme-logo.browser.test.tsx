import BrandProvider from '@/features/branding/brand-provider';
import ThemeLogo from '@/shared/components/theme-logo';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('ThemeLogo', () => {
  it('shows the selected brand logo and name instead of the default theme logos', () => {
    render(
      <BrandProvider
        brand={{ name: 'School OJ', logo: 'https://cdn.school.edu/logo.png' }}
      >
        <ThemeLogo alt="Default logo" width={290} height={87} />
      </BrandProvider>
    );
    const logo = screen.getByRole('img', { name: 'School OJ' });
    expect(logo).toBeVisible();
    expect(logo).toHaveAttribute('src', 'https://cdn.school.edu/logo.png');
    expect(screen.queryByRole('img', { name: 'Default logo' })).toBeNull();
  });
  it.each([undefined, 'lazy'] as const)(
    'applies loading=%s to both theme images',
    (loading) => {
      render(
        <ThemeLogo alt="Logo" width={290} height={87} loading={loading} />
      );

      const images = screen.getAllByRole('img', { name: 'Logo' });
      expect(images).toHaveLength(2);
      for (const image of images) {
        expect(image).toHaveAttribute('loading', loading ?? 'lazy');
      }
      expect(images[0]).toHaveClass('dark:hidden');
      expect(images[1]).toHaveClass('hidden', 'dark:block');
    }
  );

  it('forwards fetchPriority without changing default lazy loading', () => {
    render(
      <ThemeLogo alt="Logo" width={290} height={87} fetchPriority="high" />
    );

    const images = screen.getAllByRole('img', { name: 'Logo' });
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toHaveAttribute('loading', 'lazy');
      expect(image).toHaveAttribute('fetchpriority', 'high');
    }
  });
});
