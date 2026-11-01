import '@/features/rewards/rewards.css';
import { getSiteBrand } from '@/features/branding/get-brand';
import { CollapsedTrigger } from '@/features/navigation/collapsed-trigger';
import OmnibarProvider from '@/features/navigation/omnibar-provider';
import AppSidebar from '@/features/navigation/sidebar';
import { getUser } from '@/features/user/lib/get-user';
import ThemeLogo from '@/shared/components/theme-logo';
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type Props = {
  children: React.ReactNode;
  banner?: React.ReactNode;
};

export default async function AppFrame({ children, banner }: Props) {
  const { name: siteName, logo } = await getSiteBrand();
  const t = await getTranslations('misc');
  const user = await getUser();

  return (
    <TooltipProvider>
      <SidebarProvider data-reward-accent={user?.rewardEquipment?.accent}>
        <OmnibarProvider>
          <AppSidebar />
          <SidebarInset className="overflow-auto p-4 has-data-[app-full-width]:px-2 has-data-[app-full-width]:pb-0 md:overflow-visible">
            <CollapsedTrigger />
            <div className="container mx-auto has-data-[app-full-width]:flex has-data-[app-full-width]:flex-1 has-data-[app-full-width]:flex-col has-data-[app-full-width]:max-w-none">
              <div className="mb-2 flex px-2 md:hidden">
                <Link
                  href="/home"
                  aria-label={siteName}
                  className="flex min-w-0 items-center gap-3"
                >
                  <ThemeLogo
                    width={290}
                    height={87}
                    alt={t('logoAlt', { siteName })}
                    className="h-auto w-30"
                  />
                  {logo && (
                    <span className="truncate text-sm font-medium">
                      {siteName}
                    </span>
                  )}
                </Link>
              </div>
              <div
                id="app-body"
                className="pt-4 has-data-[app-full-width]:flex has-data-[app-full-width]:flex-1 has-data-[app-full-width]:flex-col"
              >
                {banner}
                {children}
              </div>
            </div>
          </SidebarInset>
        </OmnibarProvider>
      </SidebarProvider>
    </TooltipProvider>
  );
}
