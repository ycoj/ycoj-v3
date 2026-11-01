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
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = { data: AccountSettingsData };

export default function DomainSettingsPage({ data }: Props) {
  const t = useTranslations('preference');
  const hasFields = data.settings.some(
    (setting) => !(setting.flag & SETTING_FLAG.HIDDEN)
  );

  return (
    <SettingsLayout
      title={t('domainTitle')}
      description={t('domainDescription')}
    >
      {hasFields ? (
        <SettingsForm data={data} category="domain" namespace="preference" />
      ) : (
        <Empty className="border" data-llm-visible="true">
          <EmptyMedia variant="icon">
            <Globe aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle data-llm-text={t('domainEmpty')}>
            {t('domainEmpty')}
          </EmptyTitle>
          <EmptyDescription data-llm-text={t('domainEmptyDescription')}>
            {t('domainEmptyDescription')}
          </EmptyDescription>
        </Empty>
      )}
    </SettingsLayout>
  );
}
