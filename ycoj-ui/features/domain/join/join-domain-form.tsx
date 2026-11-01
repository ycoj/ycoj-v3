'use client';

import ClientApis from '@/api/client/method';
import type { DomainJoinResponse } from '@/api/server/method/domain/types';
import { JOIN_METHOD } from '@/features/domain/lib/join-policy';
import { resolvePostJoinPath } from '@/features/domain/lib/join-redirect';
import UserSpan from '@/features/user/user-span';
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
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { UserRoundPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

type Props = {
  data: DomainJoinResponse;
  target: string;
  /** Domain the current page is rendered in, used to resolve the destination. */
  activeDomainId: string;
  /** Pre-rendered server markup; the Markdown engine is server-only. */
  bulletin?: ReactNode;
};

export default function JoinDomainForm({
  data,
  target,
  activeDomainId,
  bulletin,
}: Props) {
  const t = useTranslations('domain');
  const router = useRouter();
  const [code, setCode] = useState(data.code ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requiresCode = data.joinSettings?.method === JOIN_METHOD.CODE;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (requiresCode && !code.trim()) {
      setError(t('joinCodeRequired'));
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const response = await ClientApis.Domain.joinDomain({
        target,
        ...(code.trim() ? { code: code.trim() } : {}),
        ...(data.redirect ? { redirect: data.redirect } : {}),
      }).send();
      if (response && 'error' in response && response.error) {
        throw new Error(
          response.error.name === 'DomainJoinAlreadyMemberError'
            ? t('joinAlreadyMember')
            : t('joinFailed')
        );
      }
      toast.success(t('joinSuccess'));
      const url =
        response && 'url' in response && typeof response.url === 'string'
          ? response.url
          : '';
      // The backend redirects to `/home` or `/d/{id}/home`; only the active
      // domain is a client route in the new UI.
      router.push(resolvePostJoinPath(url, activeDomainId));
      router.refresh();
    } catch (submitError) {
      toast.error(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : t('joinFailed')
      );
    } finally {
      setSubmitting(false);
    }
  };

  const title = data.joinSettings
    ? t('joinTitle', { domain: data.domainInfo.name })
    : t('joinInvitedTitle', { domain: data.domainInfo.name });

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4" data-llm-visible="true">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold" data-llm-text={title}>
              {title}
            </h1>
          </CardTitle>
          <CardDescription
            data-llm-text={t('joinDescription', {
              domain: data.domainInfo.name,
            })}
          >
            {t('joinDescription', { domain: data.domainInfo.name })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className="text-muted-foreground"
              data-llm-text={t('joinOwner')}
            >
              {t('joinOwner')}
            </span>
            <UserSpan user={data.domainInfo.owner} />
          </div>

          {bulletin}

          <form onSubmit={(event) => void submit(event)} noValidate>
            {requiresCode && (
              <Field className="mb-4">
                <FieldLabel htmlFor="join-invitation-code">
                  {t('joinCode')}
                </FieldLabel>
                <Input
                  id="join-invitation-code"
                  name="code"
                  autoFocus
                  required
                  value={code}
                  aria-invalid={!!error}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError('');
                  }}
                />
                {error ? (
                  <FieldError data-llm-text={error}>{error}</FieldError>
                ) : (
                  <FieldDescription data-llm-text={t('joinCodeHint')}>
                    {t('joinCodeHint')}
                  </FieldDescription>
                )}
              </Field>
            )}
            <div className="flex justify-end gap-2">
              <Button asChild variant="outline" type="button">
                <Link href="/home/domain">{t('backToMyDomains')}</Link>
              </Button>
              <Button type="submit" disabled={submitting}>
                <UserRoundPlus aria-hidden="true" />
                {t('joinSubmit')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
