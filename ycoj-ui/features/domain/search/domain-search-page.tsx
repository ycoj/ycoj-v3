'use client';

import ClientApis from '@/api/client/method';
import type { DomainSearchItem } from '@/api/server/method/domain/types';
import { Button } from '@/shared/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { Input } from '@/shared/components/ui/input';
import { LoaderCircle, Plus, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

type Props = {
  initialQuery: string;
  initialResults: DomainSearchItem[];
};

export default function DomainSearchPage({
  initialQuery,
  initialResults,
}: Props) {
  const t = useTranslations('domain');
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(initialResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const search = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    setLoading(true);
    setError('');
    try {
      const found = await ClientApis.Domain.searchDomainsClient(trimmed).send();
      setResults(Array.isArray(found) ? found : []);
    } catch {
      setError(t('loadFailed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="mx-auto w-full max-w-3xl space-y-4"
      data-llm-visible="true"
    >
      <header className="space-y-1">
        <h1
          className="text-xl font-semibold"
          data-llm-text={t('domainSearchTitle')}
        >
          {t('domainSearchTitle')}
        </h1>
        <p
          className="text-sm text-muted-foreground"
          data-llm-text={t('searchHint')}
        >
          {t('searchHint')}
        </p>
      </header>

      <form onSubmit={(event) => void search(event)} className="flex gap-2">
        <div className="relative flex-1">
          <Input
            name="q"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchPlaceholder')}
            className="pl-9"
          />
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        </div>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Search aria-hidden="true" />
          )}
          {t('search')}
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-llm-text={error}
        >
          {error}
        </p>
      )}

      <div
        aria-label={t('domainSearchLabel')}
        role="list"
        className="space-y-2"
      >
        {results.length === 0 ? (
          <Empty className="min-h-40 border">
            <EmptyHeader>
              <EmptyTitle data-llm-text={t('searchEmpty')}>
                {t('searchEmpty')}
              </EmptyTitle>
              <EmptyDescription data-llm-text={t('searchHint')}>
                {t('searchHint')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          results.map((item) => (
            <div
              key={item._id}
              role="listitem"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 ring-1 ring-foreground/10"
              data-llm-visible="true"
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className="truncate font-medium"
                  data-llm-text={item.name || item._id}
                >
                  {item.name || item._id}
                </span>
                <span
                  className="font-mono text-xs text-muted-foreground"
                  data-llm-text={item._id}
                >
                  {item._id}
                </span>
              </div>
              <Button asChild size="sm">
                <Link
                  href={`/domain/join?target=${encodeURIComponent(item._id)}`}
                >
                  <Plus aria-hidden="true" />
                  {t('joinSubmit')}
                </Link>
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
