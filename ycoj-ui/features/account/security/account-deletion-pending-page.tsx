'use client';

import SettingsLayout from '@/features/account/settings/settings-layout';
import { Button } from '@/shared/components/ui/button';
import { Clock, House, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

export default function AccountDeletionPendingPage() {
  const t = useTranslations('security');

  return (
    <SettingsLayout title={t('title')} description={t('description')}>
      <div
        className="max-w-2xl space-y-4 rounded-xl border border-border bg-card p-6"
        data-llm-visible="true"
      >
        <div className="flex items-start gap-3">
          <Clock
            className="mt-0.5 size-6 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-2">
            <h2
              className="text-lg font-semibold"
              data-llm-text={t('deletion.pendingTitle')}
            >
              {t('deletion.pendingTitle')}
            </h2>
            <p
              className="text-sm text-muted-foreground"
              data-llm-text={t('deletion.pendingDescription')}
            >
              {t('deletion.pendingDescription')}
            </p>
            <p
              className="text-sm text-muted-foreground"
              data-llm-text={t('deletion.pendingCancel')}
            >
              {t('deletion.pendingCancel')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-9">
          <Button asChild variant="secondary">
            <Link href="/home/settings/security">
              <ShieldCheck aria-hidden="true" />
              {t('deletion.back')}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/home">
              <House aria-hidden="true" />
              {t('backHome')}
            </Link>
          </Button>
        </div>
      </div>
    </SettingsLayout>
  );
}
