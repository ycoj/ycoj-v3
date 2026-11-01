'use client';

import { Button } from '@/shared/components/ui/button';
import type { LoginProvider } from '@/shared/types/auth';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  providers: LoginProvider[];
  redirect?: string;
};

/** Same-site start URL for a provider; the backend owns the callback. */
export function providerLoginHref(providerId: string, redirect?: string) {
  const path = `/oauth/${encodeURIComponent(providerId)}/login`;
  return redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;
}

export default function LoginProviders({ providers, redirect }: Props) {
  const t = useTranslations('auth');
  if (!providers.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span data-llm-text={t('orContinueWith')}>{t('orContinueWith')}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider.id}
            asChild
            variant="outline"
            className="w-full"
          >
            <Link href={providerLoginHref(provider.id, redirect)}>
              {provider.text}
            </Link>
          </Button>
        ))}
      </div>
    </div>
  );
}
