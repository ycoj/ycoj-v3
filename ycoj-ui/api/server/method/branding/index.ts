import { alova } from '@/api/server';
import type { Brand, BrandingConfig } from '@/shared/types/branding';
import type { Errorable } from '@/shared/types/error';

export const getBrand = (origin: string) =>
  alova.Get<Errorable<{ brand: Brand | null }>>('/branding', {
    params: { origin },
    cacheFor: 0,
  });

export const getBrandingConfig = () =>
  alova.Get<Errorable<{ config: BrandingConfig }> | { url: string }>(
    '/manage/branding',
    { cacheFor: 0 }
  );

const Branding = { getBrand, getBrandingConfig };
export default Branding;
