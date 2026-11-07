'use client';

import ClientApis from '@/api/client/method';
import type { CoinAdjustmentResult } from '@/api/client/method/domain/coins';
import type { DomainCoinsResponse } from '@/api/server/method/domain/types';
import {
  coinAdjustFieldErrors,
  coinAdjustPayload,
  type CoinDirection,
} from '@/features/domain/coins/coin-adjust-utils';
import { isSudoRedirect } from '@/features/domain/lib/domain-submit';
import UserAutoComplete from '@/features/user/user-auto-complete';
import { Button } from '@/shared/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  BackendResponseError,
  throwBackendError,
} from '@/shared/lib/backend-response';
import { LoaderCircle } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';

type Props = {
  data: DomainCoinsResponse;
  domainId: string;
};

const SERVER_ERRORS = new Set([
  'user-not-in-domain',
  'invalid-users',
  'invalid-amount',
  'invalid-note',
  'invalid-request',
  'busy',
]);

function freshRequestId() {
  const raw = globalThis.crypto?.randomUUID?.() ?? `adjust${Date.now()}`;
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return cleaned.length >= 8 ? cleaned : cleaned.padEnd(8, '0');
}

export default function DomainCoinsPage({ data, domainId }: Props) {
  const t = useTranslations('domainAdmin');
  const format = useFormatter();
  const [uids, setUids] = useState<string[]>([]);
  const [direction, setDirection] = useState<CoinDirection>('grant');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [results, setResults] = useState<
    CoinAdjustmentResult['adjustments'] | null
  >(null);
  const requestId = useRef(freshRequestId());

  const draft = { uids, direction, amount, reason };
  const fieldErrors = attempted ? coinAdjustFieldErrors(draft) : [];
  const fieldMessage = (field: 'users' | 'amount' | 'reason') =>
    fieldErrors.includes(field) ? t(`coinsErrors.${field}`) : '';

  const submit = async () => {
    setAttempted(true);
    setServerError('');
    const payload = coinAdjustPayload(draft, requestId.current);
    if (!payload || busy) return;
    setBusy(true);
    try {
      const response =
        await ClientApis.Domain.adjustDomainCoins(payload).send();
      throwBackendError(response as object);
      const applied = response as CoinAdjustmentResult;
      setResults(applied.adjustments);
      setReason('');
      setAttempted(false);
      requestId.current = freshRequestId();
    } catch (error) {
      if (isSudoRedirect(error)) return;
      const code =
        error instanceof BackendResponseError &&
        SERVER_ERRORS.has(error.message)
          ? error.message
          : 'request-failed';
      setServerError(t(`coinsErrors.${code}`));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-llm-visible="true">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold" data-llm-text={t('coinsTitle')}>
          {t('coinsTitle')}
        </h1>
        <p
          className="text-sm text-muted-foreground"
          data-llm-text={`${data.domain.name}. ${t('coinsDescription')}`}
        >
          {data.domain.name}. {t('coinsDescription')}
        </p>
      </header>

      <form
        className="max-w-xl space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <Field>
          <FieldLabel>{t('coinsDirection')}</FieldLabel>
          <div
            className="flex gap-2"
            role="radiogroup"
            aria-label={t('coinsDirection')}
          >
            {(['grant', 'deduct'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                role="radio"
                aria-checked={direction === value}
                size="sm"
                variant={direction === value ? 'default' : 'outline'}
                disabled={busy}
                onClick={() => setDirection(value)}
              >
                {value === 'grant' ? t('coinsGrant') : t('coinsDeduct')}
              </Button>
            ))}
          </div>
        </Field>

        <Field data-invalid={fieldMessage('amount') ? true : undefined}>
          <FieldLabel htmlFor="coin-amount">{t('coinsAmount')}</FieldLabel>
          <Input
            id="coin-amount"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            disabled={busy}
            aria-invalid={fieldMessage('amount') ? true : undefined}
            onChange={(event) => setAmount(event.target.value)}
          />
          <FieldError>{fieldMessage('amount')}</FieldError>
        </Field>

        <Field data-invalid={fieldMessage('users') ? true : undefined}>
          <FieldLabel htmlFor="coin-members">{t('coinsMembers')}</FieldLabel>
          <UserAutoComplete
            id="coin-members"
            multiple
            domainId={domainId}
            value={uids}
            onValueChange={setUids}
            ariaLabel={t('coinsMembers')}
            disabled={busy}
          />
          <FieldError>{fieldMessage('users')}</FieldError>
        </Field>

        <Field data-invalid={fieldMessage('reason') ? true : undefined}>
          <FieldLabel htmlFor="coin-reason">{t('coinsReason')}</FieldLabel>
          <Textarea
            id="coin-reason"
            value={reason}
            disabled={busy}
            maxLength={200}
            placeholder={t('coinsReasonPlaceholder')}
            aria-invalid={fieldMessage('reason') ? true : undefined}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldError>{fieldMessage('reason')}</FieldError>
        </Field>

        <FieldDescription data-llm-text={t('coinsHint')}>
          {t('coinsHint')}
        </FieldDescription>

        {serverError ? <FieldError>{serverError}</FieldError> : null}

        <Button type="submit" disabled={busy}>
          {busy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : null}
          {t('coinsSubmit')}
        </Button>
      </form>

      {results ? (
        <ul className="max-w-xl space-y-1 text-sm" data-llm-visible="true">
          {results.map((row) => {
            const label = row.applied
              ? t('coinsResult', {
                  uid: row.uid,
                  amount: format.number(row.amount, {
                    signDisplay: 'exceptZero',
                  }),
                  balance: format.number(row.balance),
                })
              : t('coinsAlreadyApplied');
            return (
              <li key={row.uid} data-llm-text={label}>
                {label}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
