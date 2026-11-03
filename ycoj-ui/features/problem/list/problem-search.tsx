'use client';

import {
  applyProblemSearchInput,
  problemFilterHref,
  type ProblemFilters,
} from '@/features/problem/list/problem-filter-utils';
import { Input } from '@/shared/components/ui/input';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

type Props = {
  filters: ProblemFilters;
};

export default function ProblemSearch({ filters }: Props) {
  const t = useTranslations('problem');
  const router = useRouter();
  const [query, setQuery] = useState(filters.q);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    router.push(
      problemFilterHref('/problem', applyProblemSearchInput(filters, query))
    );
  };

  return (
    <form onSubmit={handleSubmit} className="min-w-0">
      <div className="relative">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="pl-10 pr-4 text-sm"
        />
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      </div>
    </form>
  );
}
