'use client';

import SecurityAuthenticators from './security-authenticators';
import SecurityDeleteAccount from './security-delete-account';
import SecurityMailForm from './security-mail-form';
import SecurityPasswordForm from './security-password-form';
import SecuritySessions from './security-sessions';
import SettingsLayout from '@/features/account/settings/settings-layout';
import { Badge } from '@/shared/components/ui/badge';
import type {
  SecurityAuthenticator,
  SecuritySession,
} from '@/shared/types/security';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Props = {
  uname: string;
  mail: string;
  tfaEnabled: boolean;
  authenticators: SecurityAuthenticator[];
  sessions: SecuritySession[];
  geoipProvider?: string | null;
  deletionPending: boolean;
};

export default function SecuritySettingsPage({
  uname,
  mail,
  tfaEnabled,
  authenticators,
  sessions,
  geoipProvider,
  deletionPending,
}: Props) {
  const t = useTranslations('security');
  const router = useRouter();

  return (
    <SettingsLayout title={t('title')} description={t('description')}>
      {deletionPending && (
        <div
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
          role="status"
          data-llm-visible="true"
        >
          <Clock
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className="text-sm font-medium"
                data-llm-text={t('deletion.pendingTitle')}
              >
                {t('deletion.pendingTitle')}
              </h2>
              <Badge variant="destructive">{t('deletion.pendingBadge')}</Badge>
            </div>
            <p
              className="text-sm text-muted-foreground"
              data-llm-text={t('deletion.pendingDescription')}
            >
              {t('deletion.pendingDescription')}
            </p>
          </div>
        </div>
      )}
      <SecurityPasswordForm />
      <SecurityMailForm currentMail={mail} />
      <SecurityAuthenticators
        uname={uname}
        tfaEnabled={tfaEnabled}
        authenticators={authenticators}
      />
      <SecuritySessions sessions={sessions} geoipProvider={geoipProvider} />
      <SecurityDeleteAccount
        onRequested={() => router.push('/home/settings/security/deleted')}
      />
    </SettingsLayout>
  );
}
