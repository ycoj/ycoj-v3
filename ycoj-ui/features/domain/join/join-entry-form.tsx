'use client';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Search, UserRoundPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** Landing form used when `/domain/join` has no target in the query. */
export default function JoinEntryForm() {
  const t = useTranslations('domain');
  const router = useRouter();
  const [target, setTarget] = useState('');

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = target.trim();
    if (!trimmed) return;
    router.push(`/domain/join?target=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-4" data-llm-visible="true">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1
              className="text-xl font-semibold"
              data-llm-text={t('joinEntryTitle')}
            >
              {t('joinEntryTitle')}
            </h1>
          </CardTitle>
          <CardDescription data-llm-text={t('joinEntryHint')}>
            {t('joinEntryHint')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4" noValidate>
            <Field>
              <FieldLabel htmlFor="join-target">
                {t('joinEntryLabel')}
              </FieldLabel>
              <Input
                id="join-target"
                name="target"
                autoFocus
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              />
              <FieldDescription className="text-xs">
                {t('joinEntryHint')}
              </FieldDescription>
            </Field>
            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="outline" type="button">
                <Link href="/domain/search">
                  <Search aria-hidden="true" />
                  {t('searchDomains')}
                </Link>
              </Button>
              <Button type="submit" disabled={!target.trim()}>
                <UserRoundPlus aria-hidden="true" />
                {t('joinEntrySubmit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
