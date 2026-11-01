'use client';

import type { SiteBrand } from '@/shared/types/branding';
import { createContext, useContext } from 'react';

const BrandContext = createContext<SiteBrand>({ name: '', logo: null });

export default function BrandProvider({
  brand,
  children,
}: {
  brand: SiteBrand;
  children: React.ReactNode;
}) {
  return (
    <BrandContext.Provider value={brand}>{children}</BrandContext.Provider>
  );
}

export const useBrand = () => useContext(BrandContext);
