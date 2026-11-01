'use client';

import SettingsForm from './settings-form';
import SettingsLayout from './settings-layout';
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  SETTING_FLAG,
  type AccountSettingsData,
} from '@/shared/types/account-settings';
import { SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = { data: AccountSettingsData };

export default function PreferenceSettingsPage({ data }: Props) {
  const t = useTranslations('preference');
  const hasFields = data.settings.some(
    (setting) => !(setting.flag & SETTING_FLAG.HIDDEN)
  );

  return (
    <SettingsLayout title={t('title')} description={t('description')}>
      {hasFields ? (
        <SettingsForm
          data={data}
          category="preference"
          namespace="preference"
        />
      ) : (
        <Empty className="border" data-llm-visible="true">
          <EmptyMedia variant="icon">
            <SlidersHorizontal aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle data-llm-text={t('empty')}>{t('empty')}</EmptyTitle>
          <EmptyDescription data-llm-text={t('emptyDescription')}>
            {t('emptyDescription')}
          </EmptyDescription>
        </Empty>
      )}
    </SettingsLayout>
  );
}
