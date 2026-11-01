'use client';

import { restartSystem } from '@/api/client/method/system/dashboard';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import {
  isSudoRequired,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { SudoRedirectError } from '@/shared/lib/sudo-navigation';
import { Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

export default function RestartPanel() {
  const t = useTranslations('system');
  const [restarting, setRestarting] = useState(false);
  const [error, setError] = useState('');

  const restart = async () => {
    setError('');
    setRestarting(true);
    try {
      const response = await restartSystem().send();
      throwBackendError(response);
      if (isSudoRequired(response)) return;
      toast.success(t('restartDone'));
    } catch (caught) {
      if (caught instanceof SudoRedirectError) return;
      const message =
        caught instanceof Error ? caught.message : t('restartFailed');
      setError(message);
      toast.error(message);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <Card className="min-w-0" data-llm-visible="true">
      <CardHeader className="space-y-1 border-b">
        <h2 className="text-base font-semibold">{t('restartTitle')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('restartDescription')}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <Button type="button" disabled={restarting} onClick={restart}>
          {restarting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {restarting ? t('restarting') : t('restart')}
        </Button>
      </CardContent>
    </Card>
  );
}
