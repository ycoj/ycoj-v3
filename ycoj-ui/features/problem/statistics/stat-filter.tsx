'use client';

import { applyStatFilterChange, buildStatSearchParams } from './stat-selection';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  PROBLEM_STAT_SORTS,
  type ProblemStatSelection,
  type ProblemStatSort,
} from '@/shared/types/problem-statistics';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props = {
  selection: ProblemStatSelection;
  languages: Array<{ name: string; display: string }>;
};

const ALL_LANGUAGES = 'all';

export default function StatFilter({ selection, languages }: Props) {
  const t = useTranslations('problemOps.stats');
  const router = useRouter();
  const [draft, setDraft] = useState<ProblemStatSelection>(selection);

  const update = (patch: {
    sort?: ProblemStatSort;
    direction?: -1 | 1;
    lang?: string;
  }) => {
    setDraft(applyStatFilterChange(draft, patch));
  };

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(`?${buildStatSearchParams(draft)}`);
      }}
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t('sort')}</span>
        <Select
          value={draft.sort}
          onValueChange={(value) => update({ sort: value as ProblemStatSort })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROBLEM_STAT_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {t(`sortOptions.${sort}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t('direction')}</span>
        <Select
          value={String(draft.direction)}
          onValueChange={(value) =>
            update({ direction: value === '-1' ? -1 : 1 })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="-1">{t('descending')}</SelectItem>
            <SelectItem value="1">{t('ascending')}</SelectItem>
          </SelectContent>
        </Select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">{t('language')}</span>
        <Select
          value={draft.lang || ALL_LANGUAGES}
          onValueChange={(value) =>
            update({ lang: value === ALL_LANGUAGES ? '' : value })
          }
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_LANGUAGES}>{t('allLanguages')}</SelectItem>
            {languages.map((language) => (
              <SelectItem key={language.name} value={language.name}>
                {language.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <Button type="submit" variant="secondary" className="gap-2">
        <Search strokeWidth={2} />
        {t('apply')}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('toggleDirection')}
        title={t('toggleDirection')}
        onClick={() => update({ direction: draft.direction === -1 ? 1 : -1 })}
      >
        {draft.direction === -1 ? (
          <ArrowDownWideNarrow strokeWidth={2} />
        ) : (
          <ArrowUpNarrowWide strokeWidth={2} />
        )}
      </Button>
    </form>
  );
}
