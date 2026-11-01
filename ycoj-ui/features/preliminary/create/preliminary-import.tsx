'use client';

import ClientApis from '@/api/client/method';
import type { ProblemAutoCompleteItem } from '@/api/client/method/problem/auto-complete';
import AsyncAutoComplete from '@/shared/components/async-auto-complete';
import { Button } from '@/shared/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { normalizeBackendPathname } from '@/shared/lib/backend-response';
import { ArrowLeft, Import } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type FormEvent } from 'react';

const itemLabel = (item: ProblemAutoCompleteItem) =>
  `${item.pid || item.docId} ${item.title}`;

export default function PreliminaryImport() {
  const t = useTranslations('preliminary');
  const autocomplete = useTranslations('autoComplete');
  const router = useRouter();
  const [pid, setPid] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const searchItems = useCallback(async (query: string) => {
    const response =
      await ClientApis.Preliminary.searchObjectiveProblems(query).send();
    if ('error' in response) throw new Error('Search failed');
    return response.pdocs;
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pid || busy) return;
    setBusy(true);
    setError('');
    try {
      const response =
        await ClientApis.Preliminary.importObjectiveProblem(pid).send();
      if ('error' in response) {
        setError(
          response.error.params
            ?.filter((value): value is string => typeof value === 'string')
            .at(-1) || t('importFailed')
        );
        return;
      }
      router.push(
        normalizeBackendPathname(
          response.url || `/preliminary/${response.paperId}/edit`
        )
      );
      router.refresh();
    } catch {
      setError(t('importFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6" data-llm-visible="true">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t('importObjective')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('importDescription')}
        </p>
      </div>
      <form className="space-y-6" onSubmit={handleSubmit}>
        <Field>
          <FieldLabel htmlFor="objective-problem">
            {t('sourceProblem')}
          </FieldLabel>
          <AsyncAutoComplete<ProblemAutoCompleteItem>
            id="objective-problem"
            value={pid}
            onValueChange={(value) => {
              setPid(value);
              setError('');
            }}
            disabled={busy}
            searchItems={searchItems}
            itemKey={(item) => String(item.docId)}
            itemLabel={itemLabel}
            renderItem={(item) => (
              <span className="break-words">{itemLabel(item)}</span>
            )}
            placeholder={t('sourcePlaceholder')}
            ariaLabel={t('sourceProblem')}
            allowEmptyQuery
            messages={{
              clear: autocomplete('clear'),
              loading: autocomplete('loading'),
              loadFailed: autocomplete('loadFailed'),
              noResults: t('noObjectiveProblems'),
            }}
          />
          <FieldDescription>{t('importSupported')}</FieldDescription>
          {error && <FieldError role="alert">{error}</FieldError>}
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={!pid || busy}>
            <Import />
            {busy ? t('importing') : t('convertToPaper')}
          </Button>
          <Button asChild variant="outline">
            <Link href="/preliminary">
              <ArrowLeft />
              {t('backToPapers')}
            </Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
