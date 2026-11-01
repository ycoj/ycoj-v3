'use client';

import { cn } from '@/shared/lib/utils';
import {
  Globe,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SettingsCategory = 'account' | 'security' | 'preference' | 'domain';

type Item = {
  category: SettingsCategory;
  href: string;
  icon: LucideIcon;
  labelKey: 'title' | 'securityTitle' | 'preferenceTitle' | 'domainTitle';
};

export const SETTINGS_SIDEBAR_ITEMS: Item[] = [
  {
    category: 'account',
    href: '/home/settings/account',
    icon: UserRound,
    labelKey: 'title',
  },
  {
    category: 'security',
    href: '/home/settings/security',
    icon: ShieldCheck,
    labelKey: 'securityTitle',
  },
  {
    category: 'preference',
    href: '/home/settings/preference',
    icon: SlidersHorizontal,
    labelKey: 'preferenceTitle',
  },
  {
    category: 'domain',
    href: '/home/settings/domain',
    icon: Globe,
    labelKey: 'domainTitle',
  },
];

export function isSettingsCategoryActive(
  pathname: string,
  href: string
): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SettingsSidebar() {
  const t = useTranslations('accountSettings');
  const pathname = usePathname();

  return (
    <aside className="space-y-3 md:min-h-56" data-llm-visible="true">
      <h2
        className="text-sm font-medium text-muted-foreground"
        data-llm-text={t('navigation')}
      >
        {t('navigation')}
      </h2>
      <nav aria-label={t('navigation')}>
        <ul className="space-y-1">
          {SETTINGS_SIDEBAR_ITEMS.map(({ href, icon: Icon, labelKey }) => {
            const active = isSettingsCategoryActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  data-llm-text={t(labelKey)}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {t(labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
