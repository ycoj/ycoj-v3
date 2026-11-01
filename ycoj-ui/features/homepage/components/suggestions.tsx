import type { SuggestionSection } from '@/api/server/method/ui/homepage';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Globe } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

/**
 * Sites from the legacy `partials/homepage/suggestion.html` card, grouped the
 * same way. The backend has no getter for `suggestion`, so a bare
 * `suggestion: true` in the homepage config means "render this static list".
 * Deployment add-ons that return a real section array override it.
 */
const DEFAULT_SECTIONS: {
  group: 'chinese' | 'english' | 'tools';
  sites: SuggestionSection['sites'];
}[] = [
  {
    group: 'chinese',
    sites: [
      { title: 'LibreOJ', link: 'https://loj.ac/' },
      { title: 'Luogu', link: 'https://www.luogu.com.cn/' },
      { title: 'UOJ', link: 'https://uoj.ac/' },
      { title: 'CometOJ', link: 'https://www.cometoj.com/' },
      { title: 'Vijos', link: 'https://vijos.org/' },
    ],
  },
  {
    group: 'english',
    sites: [
      { title: 'Codeforces', link: 'https://codeforces.com/' },
      { title: 'AtCoder', link: 'https://atcoder.jp/' },
      { title: 'CodeChef', link: 'https://www.codechef.com/' },
      { title: 'SPOJ', link: 'https://www.spoj.com/' },
      { title: 'TopCoder', link: 'https://www.topcoder.com/' },
      { title: 'OnlineJudge', link: 'https://onlinejudge.org/' },
    ],
  },
  {
    group: 'tools',
    sites: [{ title: 'OIerDb', link: 'https://oier.baoshuo.dev/' }],
  },
];

type Props = {
  sections?: SuggestionSection[];
  /** Render the built-in legacy list instead of configured sections. */
  useDefaults?: boolean;
};

export default function Suggestions({ sections, useDefaults }: Props) {
  const t = useTranslations('homepage');
  const visibleSections = useDefaults
    ? DEFAULT_SECTIONS.map(({ group, sites }) => ({
        title: t(`suggestionGroups.${group}`),
        sites,
      }))
    : (sections ?? []).filter((section) => section.sites.length > 0);
  if (!visibleSections.length) return null;

  return (
    <Card data-llm-visible="true">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="size-5" />
          <span data-llm-text={t('suggestions')}>{t('suggestions')}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {visibleSections.map((section, index) => (
            <div data-llm-visible="true" key={`${section.title}-${index}`}>
              <div className="space-y-2">
                <p
                  data-llm-text={section.title}
                  className="text-sm font-medium text-foreground"
                >
                  {section.title}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5">
                  {section.sites.map((site, siteIndex) => (
                    <Link
                      key={`${site.title}-${site.link}-${siteIndex}`}
                      href={site.link}
                      prefetch={false}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-llm-text={site.title}
                      className="text-muted-foreground hover:text-foreground inline-flex max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm underline-offset-4 hover:underline"
                    >
                      {site.title}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
