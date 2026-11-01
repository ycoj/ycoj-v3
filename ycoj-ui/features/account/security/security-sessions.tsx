'use client';

import { resolveSecurityResult } from './resolve-security-result';
import {
  sessionBrowserLabel,
  sessionHostLabel,
  sessionIpLabel,
  sessionLocationLabel,
  sessionOsLabel,
  sortSessions,
} from './security-utils';
import ClientApis from '@/api/client/method';
import SettingsSection from '@/features/account/settings/settings-section';
import ConfirmActionDialog from '@/shared/components/confirm-action-dialog';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
} from '@/shared/components/ui/empty';
import { Separator } from '@/shared/components/ui/separator';
import { formatRecordTime } from '@/shared/lib/format-time';
import type { SecuritySession } from '@/shared/types/security';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  sessions: SecuritySession[];
  geoipProvider?: string | null;
};

export default function SecuritySessions({ sessions, geoipProvider }: Props) {
  const t = useTranslations('security');
  const router = useRouter();
  const [signingOutAll, setSigningOutAll] = useState(false);
  const ordered = sortSessions(sessions);
  const otherSessions = ordered.filter((session) => !session.isCurrent);

  const signOutSession = async (tokenDigest: string) => {
    const response = await ClientApis.Account.deleteSession(tokenDigest).send();
    if (resolveSecurityResult(response) === 'sudo') return;
    toast.success(t('sessions.signedOut'));
    router.refresh();
  };

  const signOutAll = async () => {
    setSigningOutAll(true);
    try {
      const response = await ClientApis.Account.deleteAllSessions().send();
      resolveSecurityResult(response);
      toast.success(t('sessions.signedOutAll'));
      const target = 'url' in response ? response.url : '/login';
      router.push(target);
    } finally {
      setSigningOutAll(false);
    }
  };

  return (
    <SettingsSection id="security-sessions" title={t('sessions.title')}>
      <div className="space-y-4">
        {ordered.length === 0 ? (
          <Empty className="border">
            <EmptyMedia variant="icon">
              <MonitorSmartphone aria-hidden="true" />
            </EmptyMedia>
            <EmptyDescription data-llm-text={t('sessions.empty')}>
              {t('sessions.empty')}
            </EmptyDescription>
          </Empty>
        ) : (
          <ul className="divide-y divide-border/60 rounded-xl border border-border/60">
            {ordered.map((session) => (
              <li
                key={session._id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between"
                data-llm-visible="true"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      className="text-sm font-medium"
                      data-llm-text={
                        sessionBrowserLabel(session) ||
                        t('sessions.unknownBrowser')
                      }
                    >
                      {sessionBrowserLabel(session) ||
                        t('sessions.unknownBrowser')}
                    </h3>
                    {session.isCurrent && (
                      <Badge
                        variant="secondary"
                        data-llm-text={t('sessions.current')}
                      >
                        {t('sessions.current')}
                      </Badge>
                    )}
                  </div>
                  <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <SessionDetail
                      label={t('sessions.operatingSystem')}
                      value={sessionOsLabel(session)}
                    />
                    <SessionDetail
                      label={t('sessions.ipAddress')}
                      value={sessionIpLabel(session)}
                    />
                    <SessionDetail
                      label={t('sessions.location')}
                      value={sessionLocationLabel(session)}
                    />
                    <SessionDetail
                      label={t('sessions.hostname')}
                      value={sessionHostLabel(session)}
                    />
                    <SessionDetail
                      label={t('sessions.lastActive')}
                      value={formatRecordTime(
                        session.updateAt,
                        'YYYY-MM-DD HH:mm'
                      )}
                    />
                  </dl>
                </div>
                {!session.isCurrent && (
                  <ConfirmActionDialog
                    title={t('sessions.signOutTitle')}
                    description={t('sessions.signOutDescription', {
                      name:
                        sessionBrowserLabel(session) ||
                        t('sessions.unknownBrowser'),
                    })}
                    confirmLabel={t('sessions.signOut')}
                    cancelLabel={t('cancel')}
                    fallbackError={t('actionFailed')}
                    confirmVariant="outline"
                    onConfirm={() => signOutSession(session._id)}
                    trigger={(pending) => (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                      >
                        <LogOut aria-hidden="true" />
                        {t('sessions.signOut')}
                      </Button>
                    )}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {geoipProvider && (
          <p
            className="text-xs text-muted-foreground"
            data-llm-text={t('sessions.geoipProvider', {
              provider: geoipProvider,
            })}
          >
            {t('sessions.geoipProvider', { provider: geoipProvider })}
          </p>
        )}
        {otherSessions.length > 0 && <Separator />}
        <ConfirmActionDialog
          title={t('sessions.signOutAllTitle')}
          description={t('sessions.signOutAllDescription')}
          confirmLabel={t('sessions.signOutAll')}
          pendingLabel={t('sessions.signingOutAll')}
          cancelLabel={t('cancel')}
          fallbackError={t('actionFailed')}
          confirmVariant="destructive"
          onConfirm={signOutAll}
          trigger={(pending) => (
            <Button
              type="button"
              variant="destructive"
              disabled={pending || signingOutAll}
            >
              {t('sessions.signOutAll')}
            </Button>
          )}
        />
      </div>
    </SettingsSection>
  );
}

function SessionDetail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex min-w-0 gap-1">
      <dt className="shrink-0">{label}:</dt>
      <dd className="min-w-0 break-all" data-llm-text={value}>
        {value}
      </dd>
    </div>
  );
}
