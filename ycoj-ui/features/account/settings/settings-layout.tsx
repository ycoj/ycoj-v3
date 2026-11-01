'use client';

import SettingsSidebar from './settings-sidebar';
import TwoColumnLayout from '@/shared/layout/two-column';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  description: string;
  children: ReactNode;
};

export default function SettingsLayout({
  title,
  description,
  children,
}: Props) {
  return (
    <div className="w-full pb-6" data-llm-visible="true">
      <TwoColumnLayout
        ratio="8-2"
        left={
          <div className="min-w-0 space-y-6">
            <header className="space-y-2">
              <h1 className="text-2xl font-semibold" data-llm-text={title}>
                {title}
              </h1>
              <p
                className="text-sm text-muted-foreground"
                data-llm-text={description}
              >
                {description}
              </p>
            </header>
            {children}
          </div>
        }
        right={<SettingsSidebar />}
      />
    </div>
  );
}
