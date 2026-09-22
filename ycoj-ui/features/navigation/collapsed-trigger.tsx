'use client';

import { useSidebar, SidebarTrigger } from '@/shared/components/ui/sidebar';

export function CollapsedTrigger() {
  const { state, isMobile, openMobile } = useSidebar();

  if (isMobile) {
    if (openMobile) return null;
    return (
      <SidebarTrigger
        variant="default"
        size="icon"
        className="fixed bottom-4 left-4 z-50 size-10 rounded-full shadow-lg md:hidden [&_svg:not([class*='size-'])]:size-5"
      />
    );
  }

  if (state !== 'collapsed') return null;

  return <SidebarTrigger />;
}
