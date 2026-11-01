'use client';

import ClientApis from '@/api/client/method';
import type { JoinApplicationsResponse } from '@/api/server/method/domain/types';
import {
  submitDomainMutation,
  isSudoRedirect,
} from '@/features/domain/lib/domain-submit';
import {
  buildJoinSettingsPayload,
  readableExpirationOptions,
  validateJoinSettings,
  type JoinSettingsFormValues,
} from '@/features/domain/lib/join-settings-form';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Separator } from '@/shared/components/ui/separator';
import { useClipboardCopy } from '@/shared/hooks/use-clipboard-copy';
import { useFormatter, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

type Props = {
  data: JoinApplicationsResponse;
  /** Current domain id, used to build invite links. */
  domainId: string;
  /** Public origin or configured domain host with a trailing slash. */
  urlPrefix: string;
};

export default function DomainJoinApplicationsPage({
  data,
  domainId,
  urlPrefix,
}: Props) {
  const t = useTranslations('domainAdmin');
  const format = useFormatter();
  const router = useRouter();
  const hasCurrentPolicy = Boolean(data.joinSettings);
  const roleOptions = (data.rolesWithText ?? []).map(([value, label]) => ({
    value,
    label,
  }));
  const current = data.joinSettings;

  const [values, setValues] = useState<JoinSettingsFormValues>({
    method: current ? (String(current.method) as '0' | '1' | '2') : '0',
    role: current?.role ?? roleOptions[0]?.value ?? '',
    group: current?.group ?? '',
    expire: '',
    invitationCode: current?.code ?? '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const expirationOptions = useMemo(
    () =>
      readableExpirationOptions(data.expirations ?? {}, hasCurrentPolicy, {
        keep: t('expireKeep'),
        never: t('expireNever'),
        hours: (hours) =>
          hours % 24 === 0
            ? t('expireInDays', { days: hours / 24 })
            : t('expireIn', { hours }),
      }),
    [data.expirations, hasCurrentPolicy, t]
  );

  const invitationLink = `${urlPrefix}d/${encodeURIComponent(domainId)}/domain/join`;
  const invitationCodeLink =
    current?.method === 2 && current.code
      ? `${invitationLink}?code=${encodeURIComponent(current.code)}`
      : '';
  const { copied, onCopy } = useClipboardCopy(
    invitationCodeLink || invitationLink
  );

  const update = <K extends keyof JoinSettingsFormValues>(
    key: K,
    value: JoinSettingsFormValues[K]
  ) => {
    setValues((currentValues) => ({ ...currentValues, [key]: value }));
    setError('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const message = validateJoinSettings(
      values,
      {
        codeInvalid: t('invitationCodeInvalid'),
        roleRequired: t('roleRequired'),
        expireRequired: t('expireRequired'),
      },
      hasCurrentPolicy
    );
    if (message) {
      setError(message);
      return;
    }
    setSubmitting(true);
    try {
      await submitDomainMutation(
        ClientApis.Domain.saveDomainJoinApplications(
          buildJoinSettingsPayload(values)
        ),
        '/domain/join-applications'
      );
      toast.success(t('joinPolicySaved'));
      router.refresh();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      toast.error(t('joinPolicyFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const expireDate = current?.expire;

  return (
    <div className="space-y-4" data-llm-visible="true">
      <h1
        className="text-xl font-semibold"
        data-llm-text={t('joinPolicyTitle')}
      >
        {t('joinPolicyTitle')}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle data-llm-text={t('invitationLinks')}>
            {t('invitationLinks')}
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-3 pt-4">
          <p className="text-sm text-muted-foreground">
            {t('invitationLinksHint')}
          </p>
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t('invitationLink')}
            </span>
            <pre className="overflow-x-auto rounded-lg bg-muted p-2 font-mono text-xs">
              <code>{invitationLink}</code>
            </pre>
          </div>
          {expireDate && (
            <p
              className="text-sm text-muted-foreground"
              data-llm-text={t('invitationExpire', {
                date: format.dateTime(new Date(expireDate), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            >
              {t('invitationExpire', {
                date: format.dateTime(new Date(expireDate), {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }),
              })}
            </p>
          )}
          {invitationCodeLink && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void onCopy()}
            >
              {copied ? t('copied') : t('copy')}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle data-llm-text={t('joinPolicyTitle')}>
            {t('joinPolicyTitle')}
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <form
            onSubmit={(event) => void submit(event)}
            className="space-y-5"
            noValidate
          >
            <p className="text-sm text-muted-foreground">
              {t('joinPolicyHint')}
            </p>
            <Field>
              <FieldLabel htmlFor="join-method">{t('joinMethod')}</FieldLabel>
              <Select
                value={values.method}
                onValueChange={(value) =>
                  update('method', value as '0' | '1' | '2')
                }
              >
                <SelectTrigger id="join-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="0">{t('joinMethods.none')}</SelectItem>
                  <SelectItem value="1">{t('joinMethods.all')}</SelectItem>
                  <SelectItem value="2">{t('joinMethods.code')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {values.method !== '0' && (
              <>
                <Field>
                  <FieldLabel htmlFor="join-role">{t('joinRole')}</FieldLabel>
                  <Select
                    value={values.role}
                    onValueChange={(value) => update('role', value)}
                  >
                    <SelectTrigger id="join-role" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {roleOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription className="text-xs">
                    {t('joinRoleHint')}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="join-group">{t('joinGroup')}</FieldLabel>
                  <Input
                    id="join-group"
                    value={values.group}
                    onChange={(event) => update('group', event.target.value)}
                  />
                  <FieldDescription className="text-xs">
                    {t('joinGroupHint')}
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="join-expire">
                    {t('joinExpire')}
                  </FieldLabel>
                  <Select
                    value={values.expire}
                    onValueChange={(value) => update('expire', value)}
                  >
                    <SelectTrigger id="join-expire" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {expirationOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription className="text-xs">
                    {t('joinExpireHint')}
                  </FieldDescription>
                </Field>

                {values.method === '2' && (
                  <Field>
                    <FieldLabel htmlFor="join-code">
                      {t('invitationCode')}
                    </FieldLabel>
                    <Input
                      id="join-code"
                      value={values.invitationCode}
                      onChange={(event) =>
                        update('invitationCode', event.target.value)
                      }
                    />
                    <FieldDescription className="text-xs">
                      {t('invitationCodeHint')}
                    </FieldDescription>
                  </Field>
                )}
              </>
            )}

            {error && <FieldError data-llm-text={error}>{error}</FieldError>}

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {t('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
