import { getJudgeStatusPage } from '@/features/system-status/get-status-page';
import StatusPage from '@/features/system-status/status-page';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('judgeStatus') };
}

export default async function JudgeStatusRoute() {
  const state = await getJudgeStatusPage();
  if (state.kind === 'error') return <Errored error={state.message} />;
  return <StatusPage data={state.data} />;
}
