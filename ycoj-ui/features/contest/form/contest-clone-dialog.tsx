'use client';

import {
  formatContestEndAt,
  type ContestCloneValues,
} from '@/features/contest/form/contest-form-utils';
import CloneDialog from '@/shared/components/clone-dialog';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { datePattern, timePattern } from '@/shared/lib/date-patterns';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Controller, useWatch, type Control } from 'react-hook-form';
import { z } from 'zod';

export type ContestCloneDialogProps = {
  defaultValues: ContestCloneValues;
  canAutoHide: boolean;
  onClose: () => void;
  onConfirm: (values: ContestCloneValues) => Promise<void>;
};

export default function ContestCloneDialog({
  defaultValues,
  canAutoHide,
  onClose,
  onConfirm,
}: ContestCloneDialogProps) {
  const t = useTranslations('contestEdit');
  const schema = z.object({
    title: z.string().trim().min(1, t('titleRequired')).max(64),
    beginAtDate: z.string().regex(datePattern, t('invalidDate')),
    beginAtTime: z.string().regex(timePattern, t('invalidTime')),
    duration: z
      .string()
      .refine((value) => Number(value) > 0, t('durationInvalid')),
    autoHide: z.boolean(),
  });

  return (
    <CloneDialog
      title={t('cloneTitle')}
      description={t('cloneDescription')}
      cloneLabel={t('clone')}
      cloningLabel={t('cloning')}
      failedLabel={t('cloneFailed')}
      resolver={zodResolver(schema)}
      defaultValues={defaultValues}
      onClose={onClose}
      onConfirm={(values) =>
        onConfirm({ ...values, autoHide: canAutoHide && values.autoHide })
      }
    >
      {({ control, register, errors, isSubmitting }) => (
        <>
          <Field>
            <FieldLabel htmlFor="clone-title">{t('contestTitle')}</FieldLabel>
            <FieldContent>
              <Input
                id="clone-title"
                autoFocus
                disabled={isSubmitting}
                aria-invalid={!!errors.title}
                {...register('title')}
              />
              <FieldError errors={[errors.title]} />
            </FieldContent>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="clone-beginAtDate">
                {t('beginDate')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="clone-beginAtDate"
                  type="date"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.beginAtDate}
                  {...register('beginAtDate')}
                />
                <FieldError errors={[errors.beginAtDate]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="clone-beginAtTime">
                {t('beginTime')}
              </FieldLabel>
              <FieldContent>
                <Input
                  id="clone-beginAtTime"
                  type="time"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.beginAtTime}
                  {...register('beginAtTime')}
                />
                <FieldError errors={[errors.beginAtTime]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="clone-duration">{t('duration')}</FieldLabel>
              <FieldContent>
                <Input
                  id="clone-duration"
                  type="number"
                  min="0.01"
                  step="0.25"
                  disabled={isSubmitting}
                  aria-invalid={!!errors.duration}
                  {...register('duration')}
                />
                <FieldError errors={[errors.duration]} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel htmlFor="clone-endAt">{t('endTime')}</FieldLabel>
              <ContestCloneEndAt control={control} />
            </Field>
          </div>
          <Field>
            <Controller
              control={control}
              name="autoHide"
              render={({ field }) => (
                <div className="flex min-w-0 items-start gap-2">
                  <Checkbox
                    id="clone-autoHide"
                    checked={canAutoHide ? field.value : false}
                    onCheckedChange={(value) => field.onChange(value === true)}
                    disabled={isSubmitting || !canAutoHide}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="clone-autoHide"
                    className="flex min-w-0 flex-col items-start gap-0.5"
                  >
                    <span>{t('autoHide')}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {t(
                        canAutoHide
                          ? 'autoHideCloneHelp'
                          : 'autoHideUnavailable'
                      )}
                    </span>
                  </Label>
                </div>
              )}
            />
          </Field>
        </>
      )}
    </CloneDialog>
  );
}

function ContestCloneEndAt({
  control,
}: {
  control: Control<ContestCloneValues>;
}) {
  const [beginAtDate, beginAtTime, duration] = useWatch({
    control,
    name: ['beginAtDate', 'beginAtTime', 'duration'],
  });
  const endAt = formatContestEndAt(beginAtDate, beginAtTime, duration);

  return <Input id="clone-endAt" value={endAt} disabled readOnly />;
}
