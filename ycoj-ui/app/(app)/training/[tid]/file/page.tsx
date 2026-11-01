import { getTrainingFiles } from '@/api/server/method/training/files';
import { getTrainingDetail } from '@/features/training/detail/get-training-detail';
import TrainingSidebar from '@/features/training/detail/training-sidebar';
import TrainingFilesManager from '@/features/training/files/training-files-manager';
import { canEditTraining } from '@/features/training/lib/can-edit-training';
import TrainingTitle from '@/features/training/training-title';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = { tid: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tid } = await params;
  const [data, t] = await Promise.all([
    getTrainingFiles(tid),
    getTranslations('metadata'),
  ]);
  if ('error' in data) return { title: t('trainingFiles') };
  return { title: `${data.tdoc.title} - ${t('trainingFiles')}` };
}

export default async function TrainingFilesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tid } = await params;
  const [data, detail, user] = await Promise.all([
    getTrainingFiles(tid),
    getTrainingDetail(tid),
    getUser(),
  ]);
  const t = await getTranslations('error');

  if ('error' in data)
    return <Errored title={t('unavailable')} error={data.error} />;

  // The handler only serves this page to owners and training editors; mirror
  // that gate so the UI does not imply access.
  if (!canEditTraining(user, data.tdoc))
    return <Errored title={t('unavailable')} error={t('unavailable')} />;

  return (
    <div className="space-y-6">
      <TrainingTitle tdoc={data.tdoc} />
      <TwoColumnLayout
        ratio="8-2"
        left={<TrainingFilesManager tid={tid} files={data.files} />}
        right={
          <TrainingSidebar tid={tid} data={detail} owner={data.udoc} canEdit />
        }
      />
    </div>
  );
}
