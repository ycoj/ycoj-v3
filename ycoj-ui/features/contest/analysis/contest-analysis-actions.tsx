'use client';

import ClientApis from '@/api/client/method';
import ConfirmActionDialog from '@/shared/components/confirm-action-dialog';
import { Button } from '@/shared/components/ui/button';
import { throwBackendError } from '@/shared/lib/backend-response';
import type { ContestAnalysisJobStatus } from '@/shared/types/contest-analysis';
import { LoaderCircle, Printer, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  jobId: string;
  status: ContestAnalysisJobStatus;
  canManage: boolean;
};

export default function ContestAnalysisActions({
  jobId,
  status,
  canManage,
}: Props) {
  const t = useTranslations('contest.analysis');
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const response =
        await ClientApis.Contest.retryContestAnalysis(jobId).send();
      throwBackendError(response);
      if (!('error' in response))
        router.push(`/contest/analysis/${response.jobId}`);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
      {canManage && status !== 'pending' && status !== 'running' && (
        <Button
          variant="outline"
          size="sm"
          disabled={retrying}
          onClick={() => void retry()}
        >
          {retrying ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" />
          )}
          {t('retry')}
        </Button>
      )}
      {canManage && (
        <ConfirmActionDialog
          title={t('deleteTitle')}
          description={t('deleteDescription')}
          confirmLabel={t('deleteConfirm')}
          cancelLabel={t('deleteCancel')}
          fallbackError={t('deleteFailed')}
          onConfirm={async () => {
            const response =
              await ClientApis.Contest.deleteContestAnalysis(jobId).send();
            throwBackendError(response);
            router.push('/contest/analysis');
          }}
          trigger={(pending) => (
            <Button variant="outline" size="sm" disabled={pending}>
              <Trash2 aria-hidden="true" />
              {t('delete')}
            </Button>
          )}
        />
      )}
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer aria-hidden="true" />
        {t('print')}
      </Button>
    </div>
  );
}
