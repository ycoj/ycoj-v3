import { alova } from '@/api/server';
import Markdown from '@/shared/components/markdown';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type AboutSection = {
  id: string;
  title: string;
  content: string;
};

type AboutResponse = {
  sections: AboutSection[];
};

/**
 * `GET /wiki/about` returns the deployment's `ui-default.about` Markdown split
 * at `# <id> <title>` headings, with `{{ name }}` already substituted. It is
 * public; the app shell still requires a session, matching every other page.
 */
const getAbout = () => alova.Get<AboutResponse>('/wiki/about');

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('about') };
}

export default async function AboutPage() {
  const t = await getTranslations('help');
  const data = await getAbout().catch(() => null);
  const sections = Array.isArray(data?.sections) ? data.sections : [];

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-2" data-llm-visible="true">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold" data-llm-text={t('aboutTitle')}>
          {t('aboutTitle')}
        </h1>
      </header>

      {sections.length === 0 ? (
        <p
          className="text-muted-foreground text-sm"
          data-llm-text={t('aboutEmpty')}
        >
          {t('aboutEmpty')}
        </p>
      ) : (
        <nav
          aria-label={t('aboutTitle')}
          className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm"
        >
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="hover:text-foreground underline-offset-4 hover:underline"
            >
              {section.title}
            </a>
          ))}
        </nav>
      )}

      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          className="scroll-mt-20 space-y-3 border-t pt-6"
          data-llm-visible="true"
        >
          <h2 className="text-lg font-medium" data-llm-text={section.title}>
            {section.title}
          </h2>
          <div className="prose-sm max-w-none">
            <Markdown>{section.content}</Markdown>
          </div>
        </section>
      ))}
    </div>
  );
}
