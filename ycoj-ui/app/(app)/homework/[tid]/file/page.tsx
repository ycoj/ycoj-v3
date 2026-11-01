import { getHomeworkFiles } from '@/api/server/method/homework/files';
import ContestTitle from '@/features/contest/contest-title';
import { getHomeworkDetail } from '@/features/homework/detail/get-homework-detail';
import HomeworkSidebar from '@/features/homework/detail/homework-sidebar';
import HomeworkFilesManager from '@/features/homework/files/homework-files-manager';
import { canEditHomework } from '@/features/homework/lib/can-edit-homework';
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
    getHomeworkDetail(tid),
    getTranslations('metadata'),
  ]);
  return { title: `${data.tdoc.title} - ${t('homeworkFiles')}` };
}

export default async function HomeworkFilesPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tid } = await params;
  const [data, user] = await Promise.all([getHomeworkFiles(tid), getUser()]);
  const t = await getTranslations('error');

  if ('error' in data)
    return <Errored title={t('unavailable')} error={data.error} />;

  // The handler only serves this page to owners, maintainers, and global
  // homework editors; mirror that gate so the UI does not imply access.
  if (!canEditHomework(user, data.tdoc))
    return <Errored title={t('unavailable')} error={t('unavailable')} />;

  return (
    <div className="space-y-6">
      <ContestTitle tdoc={data.tdoc} />
      <TwoColumnLayout
        ratio="8-2"
        left={<HomeworkFilesManager tid={tid} files={data.files} />}
        right={
          <HomeworkSidebar
            tid={tid}
            homework={data.tdoc}
            homeworkStatus={data.tsdoc}
            owner={data.udoc}
            canEdit
          />
        }
      />
    </div>
  );
}
