import 'server-only';
import { getBrand } from '@/api/server/method/branding';
import type { SiteBrand } from '@/shared/types/branding';
import { headers } from 'next/headers';
import { unstable_rethrow } from 'next/navigation';
import { cache } from 'react';

export const getSiteBrand = cache(async (): Promise<SiteBrand> => {
  const h = await headers();
  const host = h.get('host') ?? '';
  const protocol = h.get('x-forwarded-proto')?.split(',')[0].trim() ?? 'http';
  const fallback = { name: process.env.SITE_NAME ?? '', logo: null };
  try {
    const response = await getBrand(`${protocol}://${host}`);
    if ('brand' in response && response.brand) return response.brand;
  } catch (error) {
    unstable_rethrow(error);
  }
  return fallback;
});
