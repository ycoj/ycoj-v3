'use client';

import {
  deletePersonalFiles,
  getPersonalFileUrl,
  resolvePersonalFileUrl,
  uploadPersonalFile,
} from '@/api/client/method/file';
import FileManager from '@/features/file/components/file-manager';
import { getFileManagerLabels } from '@/features/file/lib/get-file-manager-labels';
import type { FileInfo } from '@/shared/types/file';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

type Props = {
  uid: number;
  files: FileInfo[];
  canManage: boolean;
};

export default function PersonalFilesManager({ uid, files, canManage }: Props) {
  const t = useTranslations('metadata');
  const fileT = useTranslations('file');
  const router = useRouter();

  const upload = async (file: File, onProgress: (ratio: number) => void) => {
    const request = uploadPersonalFile(file);
    request.onUpload(({ loaded, total }) =>
      onProgress(total > 0 ? loaded / total : 0)
    );
    const response = await request.send();
    if ('error' in response) throw new Error(response.error.message ?? '');
    router.refresh();
  };

  const remove = async (names: string[]) => {
    const response = await deletePersonalFiles(names).send();
    if ('error' in response) throw new Error(response.error.message ?? '');
    router.refresh();
  };

  return (
    <FileManager
      files={files}
      canManage={canManage}
      labels={getFileManagerLabels(fileT, t('personalFiles'))}
      fileUrl={(name) => getPersonalFileUrl(uid, name)}
      previewUrl={(name) => resolvePersonalFileUrl(uid, name)}
      onUpload={upload}
      onDelete={remove}
    />
  );
}
