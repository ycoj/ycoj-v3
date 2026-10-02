import { formatFileSize } from '@/features/problem/files/format-file-size';
import { Button } from '@/shared/components/ui/button';
import type { FileInfo } from '@/shared/types/file';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  tid: string;
  /**
   * Materials the viewer may download. The backend only returns them after the
   * user attends and the contest starts, so an empty list needs no empty state.
   */
  files: FileInfo[];
};

export default function ContestMaterials({ tid, files }: Props) {
  const t = useTranslations('contest');
  if (!files.length) return null;

  return (
    <section
      id="contest-materials"
      className="space-y-4 border-t pt-8"
      data-llm-visible="true"
    >
      <h2 className="text-xl font-semibold" data-llm-text={t('materials')}>
        {t('materials')}
      </h2>
      <ul className="divide-y border-y">
        {files.map((file) => {
          const downloadLabel = t('downloadMaterial', { name: file.name });
          return (
            <li
              key={file.name}
              className="flex items-center gap-3 px-3 py-2.5 text-sm"
            >
              <span
                className="min-w-0 flex-1 truncate font-mono"
                title={file.name}
                data-llm-text={file.name}
              >
                {file.name}
              </span>
              <span className="w-16 shrink-0 text-right text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <Button
                asChild
                variant="ghost"
                size="icon-xs"
                title={downloadLabel}
                aria-label={downloadLabel}
              >
                <a
                  href={`/api/contest/${encodeURIComponent(tid)}/file/private/${encodeURIComponent(file.name)}`}
                  download={file.name}
                >
                  <Download />
                </a>
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
