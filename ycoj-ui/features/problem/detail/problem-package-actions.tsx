'use client';

import CopyProblemsDialog from '@/features/problem/copy/copy-problems-dialog';
import { downloadProblemPackages } from '@/features/problem/package/download-problem-packages';
import { Button } from '@/shared/components/ui/button';
import { Copy, Download, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  docId: number;
  domainId: string;
  allowDownload: boolean;
  allowCopy: boolean;
};

/**
 * Problem-detail sidebar actions. They reuse the list bulk package downloader
 * and copy dialog so both entry points share one behavior.
 */
export default function ProblemPackageActions({
  docId,
  domainId,
  allowDownload,
  allowCopy,
}: Props) {
  const t = useTranslations('problemList.package');
  const [downloading, setDownloading] = useState(false);

  const download = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await downloadProblemPackages([docId], domainId);
      toast.success(t('ready'));
    } catch (error) {
      toast.error(
        error instanceof Error && error.message ? error.message : t('failed')
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {allowDownload && (
        <Button
          type="button"
          className="h-10 w-full justify-start gap-3 px-4"
          variant="ghost"
          disabled={downloading}
          onClick={() => void download()}
        >
          {downloading ? (
            <LoaderCircle strokeWidth={2} className="animate-spin" />
          ) : (
            <Download strokeWidth={2} />
          )}
          <span data-llm-text={t('download')}>{t('download')}</span>
        </Button>
      )}
      {allowCopy && (
        <CopyProblemsDialog
          pids={[docId]}
          trigger={
            <Button
              type="button"
              className="h-10 w-full justify-start gap-3 px-4"
              variant="ghost"
            >
              <Copy strokeWidth={2} />
              <span data-llm-text={t('copy')}>{t('copy')}</span>
            </Button>
          }
        />
      )}
    </>
  );
}
