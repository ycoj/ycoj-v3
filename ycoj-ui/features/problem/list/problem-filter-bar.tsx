'use client';

import {
  getRandomProblem,
  randomProblemHref,
} from '@/api/client/method/problem/random';
import {
  buildRandomProblemQuery,
  difficultyRangeToLevels,
  flipProblemSort,
  levelsToDifficultyRange,
  normalizeDifficultyLevel,
  problemFilterHref,
  updateProblemFilters,
  type ProblemFilters,
  type ProblemSortMetric,
} from '@/features/problem/list/problem-filter-utils';
import ProblemDifficulty from '@/features/problem/problem-difficulty';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { PROBLEMS_DIFFICULTY_KEYS } from '@/shared/configs/difficulty';
import { cn } from '@/shared/lib/utils';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Dices,
  Filter,
  LoaderCircle,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Props = {
  filters: ProblemFilters;
  categories: Record<string, string[]>;
  namespaces: string[];
  /** Extra control aligned to the end of the filter row, such as edit mode. */
  trailing?: ReactNode;
};

const ALL = '__all__';
const LEVELS = Array.from({ length: 9 }, (_, level) => level);

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'hover:bg-muted rounded-full border px-3 py-1 text-xs transition-colors',
        active
          ? 'border-primary bg-primary/10 text-foreground font-medium'
          : 'border-border text-muted-foreground'
      )}
    >
      {label}
    </button>
  );
}

export default function ProblemFilterBar({
  filters,
  categories,
  namespaces,
  trailing,
}: Props) {
  const t = useTranslations('problemList.filters');
  const difficultyT = useTranslations('difficulty');
  const router = useRouter();
  const [randomPending, setRandomPending] = useState(false);

  const categoryEntries = Object.entries(categories);
  const hasFilters =
    filters.category.length > 0 ||
    filters.difficulty.length > 0 ||
    Boolean(filters.namespace);

  const apply = (patch: Partial<ProblemFilters>) => {
    const next = updateProblemFilters(filters, patch);
    router.push(problemFilterHref('/problem', next));
  };

  const toggleCategory = (category: string) => {
    const selected = filters.category.includes(category)
      ? filters.category.filter((item) => item !== category)
      : [...filters.category, category];
    apply({ category: selected });
  };

  const toggleDifficulty = (level: number) => {
    const selected = filters.difficulty.includes(level)
      ? filters.difficulty.filter((item) => item !== level)
      : [...filters.difficulty, level].sort((a, b) => a - b);
    apply({ difficulty: selected });
  };

  const setDifficultyRange = (boundary: 'min' | 'max', rawValue: string) => {
    const level = rawValue === ALL ? null : normalizeDifficultyLevel(rawValue);
    const range = levelsToDifficultyRange(filters.difficulty);
    apply({
      difficulty: difficultyRangeToLevels({ ...range, [boundary]: level }),
    });
  };

  const pickRandom = async () => {
    if (randomPending) return;
    setRandomPending(true);
    try {
      const response = await getRandomProblem(
        buildRandomProblemQuery(filters.category)
      ).send();
      if (!response || 'error' in response) throw new Error(t('randomFailed'));
      const href = randomProblemHref(response);
      if (!href) throw new Error(t('randomFailed'));
      router.push(href);
    } catch {
      toast.error(t('randomFailed'));
    } finally {
      setRandomPending(false);
    }
  };

  const range = levelsToDifficultyRange(filters.difficulty);

  return (
    <div className="flex flex-wrap items-center gap-2" data-llm-visible="true">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" type="button">
            <Filter className="text-muted-foreground" />
            <span>{t('category')}</span>
            {filters.category.length > 0 && (
              <Badge variant="secondary">{filters.category.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <PopoverHeader>
            <PopoverTitle data-llm-text={t('category')}>
              {t('category')}
            </PopoverTitle>
          </PopoverHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto">
            {categoryEntries.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {t('allCategories')}
              </p>
            )}
            {categoryEntries.map(([category, children]) => (
              <div key={category} className="space-y-1.5">
                <FilterChip
                  label={category}
                  active={filters.category.includes(category)}
                  onClick={() => toggleCategory(category)}
                />
                {children.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-2">
                    {children.map((child) => (
                      <FilterChip
                        key={child}
                        label={child}
                        active={filters.category.includes(child)}
                        onClick={() => toggleCategory(child)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" type="button">
            <span>{t('difficulty')}</span>
            {filters.difficulty.length > 0 && (
              <Badge variant="secondary">{filters.difficulty.length}</Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80">
          <PopoverHeader>
            <PopoverTitle data-llm-text={t('difficulty')}>
              {t('difficulty')}
            </PopoverTitle>
          </PopoverHeader>
          <div className="flex flex-wrap gap-1.5">
            {LEVELS.map((level) => (
              <button
                key={PROBLEMS_DIFFICULTY_KEYS[level]}
                type="button"
                aria-pressed={filters.difficulty.includes(level)}
                aria-label={difficultyT(PROBLEMS_DIFFICULTY_KEYS[level])}
                onClick={() => toggleDifficulty(level)}
                className={cn(
                  'rounded-full border px-1 py-0.5 transition-colors',
                  filters.difficulty.includes(level)
                    ? 'border-primary bg-primary/10'
                    : 'border-transparent opacity-60 hover:opacity-100'
                )}
              >
                <ProblemDifficulty difficulty={level} />
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            {(['min', 'max'] as const).map((boundary) => (
              <label key={boundary} className="space-y-1 text-xs">
                <span className="text-muted-foreground">
                  {boundary === 'min' ? t('minDifficulty') : t('maxDifficulty')}
                </span>
                <Select
                  value={
                    range[boundary] === null ? ALL : String(range[boundary])
                  }
                  onValueChange={(value) => setDifficultyRange(boundary, value)}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t('anyDifficulty')}</SelectItem>
                    {LEVELS.map((level) => (
                      <SelectItem
                        key={PROBLEMS_DIFFICULTY_KEYS[level]}
                        value={String(level)}
                      >
                        {difficultyT(PROBLEMS_DIFFICULTY_KEYS[level])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {namespaces.length > 0 && (
        <Select
          value={filters.namespace || ALL}
          onValueChange={(value) =>
            apply({ namespace: value === ALL ? '' : value })
          }
        >
          <SelectTrigger aria-label={t('namespace')}>
            <SelectValue placeholder={t('allNamespaces')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allNamespaces')}</SelectItem>
            {namespaces.map((namespace) => (
              <SelectItem key={namespace} value={namespace}>
                {namespace}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex items-center">
        <Select
          value={filters.sort}
          onValueChange={(value) => apply({ sort: value as ProblemSortMetric })}
        >
          <SelectTrigger aria-label={t('sort')} className="rounded-r-none">
            <ArrowUpDown className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">{t('sortDefault')}</SelectItem>
            <SelectItem value="recent">{t('sortRecent')}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          type="button"
          className="-ml-px rounded-l-none"
          aria-label={filters.dir === 'asc' ? t('ascending') : t('descending')}
          title={filters.dir === 'asc' ? t('ascending') : t('descending')}
          onClick={() => {
            const next = flipProblemSort(filters.sort, filters.dir);
            apply({ sort: next.metric, dir: next.direction });
          }}
        >
          {filters.dir === 'asc' ? <ArrowUp /> : <ArrowDown />}
        </Button>
      </div>

      <Button
        variant="outline"
        type="button"
        onClick={() => void pickRandom()}
        disabled={randomPending}
      >
        {randomPending ? (
          <LoaderCircle className="animate-spin" />
        ) : (
          <Dices className="text-muted-foreground" />
        )}
        <span data-llm-text={t('random')}>{t('random')}</span>
      </Button>

      {hasFilters && (
        <Button
          variant="ghost"
          type="button"
          onClick={() => apply({ category: [], difficulty: [], namespace: '' })}
        >
          <X />
          <span>{t('reset')}</span>
        </Button>
      )}

      {trailing && <div className="ml-auto shrink-0">{trailing}</div>}
    </div>
  );
}
