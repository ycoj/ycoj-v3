'use client';

import { describePrivDelta, privBits, type UserPrivOption } from './priv-utils';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/shared/components/ui/field';
import { useTranslations } from 'next-intl';

type Props = {
  options: UserPrivOption[];
  mask: number;
  onToggle: (next: number) => void;
  disabled?: boolean;
  idPrefix: string;
};

/** Expands the `PRIV_ALL` sentinel into the union of known bits for display. */
export function normalizePrivMask(mask: number, options: UserPrivOption[]) {
  if (mask !== -1) return mask;
  return options.reduce((acc, option) => acc | option.value, 0);
}

/** Accessible checkbox matrix for editing one 32-bit privilege mask. */
export default function PrivEditor({
  options,
  mask,
  onToggle,
  disabled,
  idPrefix,
}: Props) {
  const t = useTranslations('system');
  const normalized = normalizePrivMask(mask, options);
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const checked = (normalized & option.value) === option.value;
          const id = `${idPrefix}-${option.name}`;
          return (
            <label
              key={option.name}
              htmlFor={id}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm"
            >
              <Checkbox
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={() => onToggle(normalized ^ option.value)}
                aria-label={option.name}
              />
              <span className="font-mono text-xs">{option.name}</span>
            </label>
          );
        })}
      </div>
      <Field>
        <FieldLabel>{t('userPrivMask')}</FieldLabel>
        <div
          className="flex flex-wrap items-center gap-2"
          data-llm-visible="true"
        >
          <Badge variant="outline" className="font-mono">
            {normalized}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {privBits(normalized, options)
              .map((option) => option.name)
              .join(', ') || '-'}
          </span>
        </div>
        <FieldDescription>{t('userPrivDialogDescription')}</FieldDescription>
      </Field>
    </div>
  );
}

export function PrivDelta({
  priv,
  defaultPriv,
  options,
}: {
  priv: number;
  defaultPriv: number;
  options: UserPrivOption[];
}) {
  const delta = describePrivDelta(priv, defaultPriv, options);
  if (!delta.length) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex flex-wrap gap-1 text-xs">
      {delta.map((entry) => (
        <span
          key={`${entry.sign}-${entry.name}`}
          className={
            entry.sign === 'plus'
              ? 'text-emerald-600 dark:text-emerald-400'
              : entry.sign === 'minus'
                ? 'text-destructive'
                : 'text-muted-foreground'
          }
        >
          {entry.sign === 'plus' ? '+' : entry.sign === 'minus' ? '-' : ''}
          {entry.name}
        </span>
      ))}
    </div>
  );
}
