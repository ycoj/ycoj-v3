import { getRewards } from '@/api/server/method/rewards';
import RewardsPage from '@/features/rewards/rewards-page';
import { getUser } from '@/features/user/lib/get-user';
import Errored from '@/shared/components/errored/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('rewards');
  return { title: t('title') };
}

export default async function RewardsRoute() {
  const [data, user] = await Promise.all([getRewards(), getUser()]);
  if (!user?._id) redirect('/login');
  if ('error' in data) return <Errored error={data.error} />;
  return <RewardsPage initialData={data} user={user} />;
}
