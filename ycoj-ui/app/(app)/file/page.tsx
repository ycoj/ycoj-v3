import { getPersonalFiles } from '@/api/server/method/file';
import { canUploadPersonalFiles } from '@/features/file/lib/can-manage-personal-files';
import PersonalFilesManager from '@/features/file/personal-files-manager';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('personalFiles') };
}

export default async function PersonalFilesPage() {
  const [data, user] = await Promise.all([getPersonalFiles(), getUser()]);
  const t = await getTranslations('error');

  if ('error' in data)
    return <Errored title={t('unavailable')} error={data.error} />;

  return (
    <div className="space-y-6" data-llm-visible="true">
      <PersonalFilesManager
        uid={user._id}
        files={data.files}
        canManage={canUploadPersonalFiles(user)}
      />
    </div>
  );
}
