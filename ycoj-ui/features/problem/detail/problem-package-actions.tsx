'use client';

import { downloadProblemPackages } from '@/features/problem/package/download-problem-packages';
import { Button } from '@/shared/components/ui/button';
import { Download, LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

type Props = {
  docId: number;
  domainId: string;
};

/**
 * Problem-detail sidebar action. It reuses the list bulk package downloader so
 * both entry points share one behavior.
 */
export default function ProblemPackageActions({ docId, domainId }: Props) {
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
  );
}
