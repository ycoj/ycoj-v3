'use client';

import ClientApis from '@/api/client/method';
import FileManager from '@/features/file/components/file-manager';
import { getFileManagerLabels } from '@/features/file/lib/get-file-manager-labels';
import type { FileInfo } from '@/shared/types/file';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Props = {
  tid: string;
  files: FileInfo[];
};

export default function HomeworkFilesManager({ tid, files }: Props) {
  const t = useTranslations('homework');
  const fileT = useTranslations('file');
  const router = useRouter();

  const upload = async (file: File, onProgress: (ratio: number) => void) => {
    const request = ClientApis.Homework.uploadHomeworkFile(tid, file);
    request.onUpload(({ loaded, total }) =>
      onProgress(total > 0 ? loaded / total : 0)
    );
    const response = await request.send();
    if ('error' in response) throw new Error(response.error.message ?? '');
    router.refresh();
  };

  const remove = async (names: string[]) => {
    const response = await ClientApis.Homework.deleteHomeworkFiles(
      tid,
      names
    ).send();
    if ('error' in response) throw new Error(response.error.message ?? '');
    router.refresh();
  };

  return (
    <FileManager
      files={files}
      canManage
      labels={getFileManagerLabels(fileT, t('files'))}
      fileUrl={(name) => ClientApis.Homework.getHomeworkFileUrl(tid, name)}
      previewUrl={(name) =>
        ClientApis.Homework.resolveHomeworkFileUrl(tid, name)
      }
      onUpload={upload}
      onDelete={remove}
    />
  );
}
