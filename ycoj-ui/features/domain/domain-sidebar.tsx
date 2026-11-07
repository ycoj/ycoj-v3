'use client';

import { cn } from '@/shared/lib/utils';
import {
  Coins,
  Info,
  KeyRound,
  ShieldCheck,
  Users,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Item = {
  href: string;
  labelKey:
    | 'console'
    | 'settings'
    | 'roles'
    | 'members'
    | 'coins'
    | 'permissionMatrix'
    | 'groups';
  icon: LucideIcon;
};

const ITEMS: Item[] = [
  { href: '/domain', labelKey: 'console', icon: Info },
  { href: '/domain/edit', labelKey: 'settings', icon: UserCog },
  { href: '/domain/role', labelKey: 'roles', icon: KeyRound },
  { href: '/domain/user', labelKey: 'members', icon: Users },
  { href: '/domain/coins', labelKey: 'coins', icon: Coins },
  {
    href: '/domain/permission',
    labelKey: 'permissionMatrix',
    icon: ShieldCheck,
  },
  { href: '/domain/group', labelKey: 'groups', icon: Users },
];

export default function DomainSidebar() {
  const t = useTranslations('domainAdmin');
  const pathname = usePathname();

  return (
    <aside className="space-y-3 md:sticky md:top-4" data-llm-visible="true">
      <h2 className="text-sm font-semibold" data-llm-text={t('navigation')}>
        {t('navigation')}
      </h2>
      <nav
        aria-label={t('navigation')}
        className="flex flex-col gap-1"
        data-llm-visible="true"
      >
        {ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === '/domain' && pathname === '/domain/');
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent',
                active && 'bg-accent text-accent-foreground'
              )}
              data-llm-text={t(item.labelKey)}
            >
              <item.icon className="size-4 shrink-0" aria-hidden="true" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
