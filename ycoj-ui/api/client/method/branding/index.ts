import { clientRequest } from '@/api/client';
import type { BrandingConfig } from '@/shared/types/branding';
import type { Errorable } from '@/shared/types/error';

export const saveBrandingConfig = (config: BrandingConfig) =>
  clientRequest.Post<Errorable<{ config: BrandingConfig }>>(
    '/manage/branding',
    { value: JSON.stringify(config) }
  );

const Branding = { saveBrandingConfig };
export default Branding;
