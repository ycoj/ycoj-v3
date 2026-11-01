import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('help') };
}

type HelpSection = {
  /** Anchor id kept from the legacy page so sidebar links still resolve. */
  id: string;
  /** Number of paragraphs under `sections.<id>.body.<n>`. */
  bodyKeys: string[];
};

/**
 * Only the parts of the legacy `wiki_help.html` that still describe how the
 * product works today. Anchors keep the ids business pages link to
 * (`#domain` from the domain page, `#contest`/`#training` from contest and
 * training sidebars, `#contact` from discussion and blog detail).
 *
 * The legacy page is a raw HTML template that is not localizable; this version
 * moves the same guidance into the translation catalogs.
 */
const HELP_SECTIONS: HelpSection[] = [
  { id: 'domain', bodyKeys: ['1', '2', '3'] },
  { id: 'limits', bodyKeys: ['1', '2'] },
  { id: 'io', bodyKeys: ['1'] },
  { id: 'judge', bodyKeys: ['1'] },
  { id: 'ce', bodyKeys: ['1', '2'] },
  { id: 'training', bodyKeys: ['1'] },
  { id: 'contest', bodyKeys: ['1', '2', '3', '4'] },
  { id: 'rp', bodyKeys: ['1'] },
  { id: 'difficulty', bodyKeys: ['1', '2'] },
  { id: 'markdown', bodyKeys: ['1'] },
  { id: 'contact', bodyKeys: ['1'] },
];

export default async function HelpPage() {
  const t = await getTranslations('help');

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-2" data-llm-visible="true">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold" data-llm-text={t('title')}>
          {t('title')}
        </h1>
        <p className="text-muted-foreground text-sm" data-llm-text={t('intro')}>
          {t('intro')}
        </p>
      </header>

      <nav
        aria-label={t('title')}
        className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-sm"
      >
        {HELP_SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {t(`sections.${section.id}.title`)}
          </a>
        ))}
      </nav>

      {HELP_SECTIONS.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`help-${section.id}`}
          className="scroll-mt-20 space-y-3 border-t pt-6"
          data-llm-visible="true"
        >
          <h2
            id={`help-${section.id}`}
            className="text-lg font-medium"
            data-llm-text={t(`sections.${section.id}.title`)}
          >
            {t(`sections.${section.id}.title`)}
          </h2>
          <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
            {section.bodyKeys.map((key) => (
              <p
                key={key}
                data-llm-text={t(`sections.${section.id}.body.${key}`)}
              >
                {t(`sections.${section.id}.body.${key}`)}
              </p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
