import { canEditContest } from '@/features/contest/lib/can-edit-contest';
import ContestManagementSidebar from '@/features/contest/management/contest-management-sidebar';
import { getContestManagement } from '@/features/contest/management/get-contest-management';
import PrintPage from '@/features/contest/print/print-page';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = { tid: string };
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('contestPrint') };
}
export default async function Page({ params }: { params: Promise<Params> }) {
  const { tid } = await params;
  const [data, user] = await Promise.all([
    getContestManagement(tid),
    getUser(),
  ]);
  const t = await getTranslations('error');
  if ('error' in data)
    return <Errored title={t('unavailable')} error={String(data.error)} />;
  if (!canEditContest(user, data.tdoc))
    return <Errored title={t('unavailable')} error={t('unavailable')} />;
  return (
    <TwoColumnLayout
      ratio="8-2"
      left={<PrintPage tid={tid} data={data} />}
      right={
        <ContestManagementSidebar
          tid={tid}
          contest={data.tdoc}
          owner={data.owner_udoc}
        />
      }
    />
  );
}
