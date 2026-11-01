import ConfigEditor from '@/features/manage/config/config-editor';
import {
  getConfigPage,
  getConfigSchema,
} from '@/features/manage/config/get-config-page';
import { canEditSystem } from '@/features/manage/manage-access';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('systemConfig') };
}

export default async function ManageConfigPage() {
  const user = await getUser();
  if (!canEditSystem(user)) redirect('/home');
  const state = await getConfigPage();
  if (state.kind === 'error') return <Errored error={state.message} />;

  // The combined schema usually arrives with the config; the dedicated
  // endpoint covers responses that only carry the YAML source.
  const schema = state.schema?.properties
    ? state.schema
    : ((await getConfigSchema()) ?? state.schema);

  return <ConfigEditor value={state.value} schema={schema} />;
}
