'use client';

import { useBrand } from '@/features/branding/brand-provider';
import ThemeLogo from '@/shared/components/theme-logo';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef } from 'react';

type Props = {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared frame for the unauthenticated auth pages: centered card, logo above,
 * and a viewport height that survives mobile browser chrome changes.
 */
export default function AuthShell({
  title,
  description,
  children,
  footer,
}: Props) {
  const brand = useBrand();
  const t = useTranslations('misc');
  const siteName = brand.name || process.env.SITE_NAME || '';
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeightVar = () => {
      const viewportHeight =
        window.visualViewport?.height ?? window.innerHeight ?? 0;
      el.style.setProperty('--app-height', `${Math.round(viewportHeight)}px`);
    };

    updateHeightVar();

    const visualViewport = window.visualViewport;
    visualViewport?.addEventListener('resize', updateHeightVar);
    visualViewport?.addEventListener('scroll', updateHeightVar);
    window.addEventListener('resize', updateHeightVar);
    window.addEventListener('orientationchange', updateHeightVar);

    return () => {
      visualViewport?.removeEventListener('resize', updateHeightVar);
      visualViewport?.removeEventListener('scroll', updateHeightVar);
      window.removeEventListener('resize', updateHeightVar);
      window.removeEventListener('orientationchange', updateHeightVar);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: 'var(--app-height, 100dvh)' }}
      className="flex items-start justify-center overflow-y-auto px-4 pt-10 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] sm:items-center sm:py-0"
    >
      <div className="flex w-full max-w-md flex-col items-center gap-6">
        <ThemeLogo
          alt={t('logoAlt', { siteName })}
          fetchPriority="high"
          width={290}
          height={87}
          sizes="160px"
          className="h-auto w-[160px]"
        />

        <Card className="w-full" data-llm-visible="true">
          <CardHeader>
            <CardTitle>
              <h1 data-llm-text={title}>{title}</h1>
            </CardTitle>
            {description && (
              <CardDescription data-llm-text={description}>
                {description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer && (
          <div className="text-center text-sm text-muted-foreground">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
