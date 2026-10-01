import DrawBoard from '@/features/draw/draw-board';
import ThemeLogo from '@/shared/components/theme-logo';
import { Button } from '@/shared/components/ui/button';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('draw');
  return { title: t('name'), description: t('description') };
}

export default async function DrawPage() {
  const t = await getTranslations('common');
  const misc = await getTranslations('misc');
  const siteName = process.env.SITE_NAME ?? '';
  return (
    // Excalidraw sizes itself from its container, so the viewport height has
    // to reach the canvas through a full-height chain.
    <div className="flex h-dvh w-full flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <ThemeLogo
          alt={misc('logoAlt', { siteName })}
          width={290}
          height={87}
          className="h-auto w-[100px]"
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/">{t('home')}</Link>
        </Button>
      </header>
      <main className="min-h-0 flex-1">
        <DrawBoard />
      </main>
    </div>
  );
}
