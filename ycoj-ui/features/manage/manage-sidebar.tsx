'use client';

import {
  canEditSystem,
  canImportUsers,
  canManageExpiration,
} from '@/features/manage/manage-access';
import { PRIV } from '@/features/user/lib/priv';
import { cn } from '@/shared/lib/utils';
import {
  Award,
  CalendarClock,
  FileCode2,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  Terminal,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ManageSidebar({ priv }: { priv: number }) {
  const t = useTranslations('manage');
  const pathname = usePathname();
  const canEdit = canEditSystem({ priv });
  const items = [
    ...(canImportUsers({ priv })
      ? [
          {
            href: '/manage/user-import',
            label: t('userImport'),
            icon: UserPlus,
          },
        ]
      : []),
    ...(priv === PRIV.PRIV_ALL
      ? [{ href: '/manage/realname', label: t('realname'), icon: UserCheck }]
      : []),
    ...(canManageExpiration({ priv })
      ? [
          {
            href: '/manage/user-expiration',
            label: t('expiration'),
            icon: CalendarClock,
          },
        ]
      : []),
    ...(canEdit
      ? [
          {
            href: '/manage/dashboard',
            label: t('dashboard'),
            icon: LayoutDashboard,
          },
          { href: '/manage/setting', label: t('settings'), icon: Settings },
          { href: '/manage/config', label: t('config'), icon: FileCode2 },
          { href: '/manage/script', label: t('script'), icon: Terminal },
          { href: '/manage/userpriv', label: t('userPriv'), icon: ShieldCheck },
          { href: '/manage/award', label: t('award'), icon: Award },
          {
            href: '/manage/ai-provider',
            label: t('aiProvider'),
            icon: Sparkles,
          },
        ]
      : []),
  ];
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
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={pathname === item.href ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent',
              pathname === item.href && 'bg-accent text-accent-foreground'
            )}
            data-llm-text={item.label}
          >
            <item.icon className="size-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
