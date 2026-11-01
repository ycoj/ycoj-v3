import type { FileManagerLabels } from '@/features/file/lib/file-manager-labels';
import { formatUploadRejections } from '@/features/file/lib/format-upload-rejections';
import type { useTranslations } from 'next-intl';

type Translator = ReturnType<typeof useTranslations>;

/**
 * Builds the shared file manager labels from the `file` namespace plus the
 * page-specific title.
 *
 * @param t Translator for the `file` namespace.
 * @param title Already-translated section title.
 */
export function getFileManagerLabels(
  t: Translator,
  title: string
): FileManagerLabels {
  const reasons = {
    invalidName: t('rejection.invalidName'),
    duplicateName: t('rejection.duplicateName'),
    exceedsCount: t('rejection.exceedsCount'),
    exceedsTotal: t('rejection.exceedsTotal'),
  };

  return {
    title,
    upload: t('upload'),
    download: t('download'),
    downloadSelected: t('downloadSelected'),
    preview: t('preview'),
    previewFile: (name) => t('previewFile', { name }),
    previewLoading: t('previewLoading'),
    previewError: t('previewError'),
    selectAll: t('selectAll'),
    selectFile: (name) => t('selectFile', { name }),
    fileNameLabel: t('fileNameLabel'),
    size: t('size'),
    modified: t('modified'),
    actions: t('actions'),
    empty: t('empty'),
    delete: t('delete'),
    deleting: t('deleting'),
    removeSelected: t('removeSelected'),
    cancel: t('cancel'),
    close: t('close'),
    confirmDelete: (count) => t('confirmDelete', { count }),
    uploadingFiles: (count) => t('uploadingFiles', { count }),
    uploadProgress: t('uploadProgress'),
    actionFailed: t('actionFailed'),
    uploadFailed: (failed, total) => t('uploadFailed', { failed, total }),
    totalSize: (size) => t('totalSize', { size }),
    formatRejections: (rejections) =>
      formatUploadRejections(rejections, reasons, t('rejection.line')),
  };
}
