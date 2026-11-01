'use client';

import { useBrand } from '@/features/branding/brand-provider';
import { cn } from '@/shared/lib/utils';
import Image, { type ImageProps } from 'next/image';

type Props = Omit<ImageProps, 'preload' | 'priority' | 'src'>;

export default function ThemeLogo({ alt, className, ...props }: Props) {
  const { logo, name } = useBrand();
  if (logo)
    return (
      <Image
        {...props}
        alt={name}
        src={logo}
        className={cn(className, 'max-h-24 object-contain object-left')}
        unoptimized
      />
    );
  return (
    <>
      <Image
        {...props}
        alt={alt}
        src="/nav-logo-small_light.png"
        className={cn(className, 'dark:hidden')}
      />
      <Image
        {...props}
        alt={alt}
        src="/nav-logo-small_dark.png"
        className={cn(className, 'hidden dark:block')}
      />
    </>
  );
}
