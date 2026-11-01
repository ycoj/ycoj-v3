import CheckConnPanel from './check-conn-panel';
import RestartPanel from './restart-panel';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

type Props = {
  /** Display name of the current domain; empty when unavailable. */
  domainName?: string;
  /** Site name configured by the server; falls back to the domain name. */
  siteName?: string;
};

export default async function DashboardConsole({
  domainName,
  siteName,
}: Props) {
  const t = await getTranslations('system');
  const rows = [
    { label: t('siteName'), value: siteName || domainName || '-' },
    { label: t('domainName'), value: domainName || '-' },
  ];
  return (
    <section className="space-y-5" data-llm-visible="true">
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-xl font-semibold"
          data-llm-text={t('title')}
        >
          <LayoutDashboard className="size-5" aria-hidden="true" />
          {t('title')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t('description')}
        </p>
      </header>
      <Card className="min-w-0" data-llm-visible="true">
        <CardHeader className="border-b">
          <h2 className="text-base font-semibold">{t('infoTitle')}</h2>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="space-y-1">
                <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {row.label}
                </dt>
                <dd className="text-sm break-words" data-llm-text={row.value}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <CheckConnPanel />
      <RestartPanel />
    </section>
  );
}
