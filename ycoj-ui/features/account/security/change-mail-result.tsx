'use client';

import { Button } from '@/shared/components/ui/button';
import { CircleAlert, CircleCheck, House, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  success: boolean;
  errorMessage?: string;
};

export default function ChangeMailResult({ success, errorMessage }: Props) {
  const t = useTranslations('security');

  const title = success
    ? t('mail.confirmedTitle')
    : t('mail.confirmFailedTitle');
  const description = success
    ? t('mail.confirmedDescription')
    : errorMessage || t('mail.confirmFailedDescription');

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center p-4"
      data-llm-visible="true"
    >
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 text-center">
        {success ? (
          <CircleCheck
            className="mx-auto size-10 text-primary"
            aria-hidden="true"
          />
        ) : (
          <CircleAlert
            className="mx-auto size-10 text-destructive"
            aria-hidden="true"
          />
        )}
        <h1 className="text-xl font-semibold" data-llm-text={title}>
          {title}
        </h1>
        <p
          className="text-sm text-muted-foreground"
          data-llm-text={description}
        >
          {description}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href={success ? '/home/settings/security' : '/'}>
              {success ? (
                <ShieldCheck aria-hidden="true" />
              ) : (
                <House aria-hidden="true" />
              )}
              {success ? t('mail.backToSecurity') : t('backHome')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
