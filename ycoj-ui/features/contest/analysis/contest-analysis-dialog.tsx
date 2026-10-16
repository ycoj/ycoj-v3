'use client';

import ClientApis from '@/api/client/method';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Field, FieldError, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Textarea } from '@/shared/components/ui/textarea';
import { throwBackendError } from '@/shared/lib/backend-response';
import type { ContestListProjection } from '@/shared/types/contest';
import type {
  ContestAnalysisLanguage,
  ContestAnalysisProfile,
} from '@/shared/types/contest-analysis';
import { LoaderCircle, Sparkles, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog } from 'radix-ui';
import { useEffect, useState } from 'react';

type Props = {
  contests: ContestListProjection[];
  onClose: () => void;
  onCreated: (jobId: string) => void;
};

export default function ContestAnalysisDialog({
  contests,
  onClose,
  onCreated,
}: Props) {
  const t = useTranslations('contest.analysis');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const language: ContestAnalysisLanguage = locale.startsWith('zh')
    ? 'zh'
    : 'en';
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<ContestAnalysisProfile[]>([]);
  const [profileId, setProfileId] = useState('');
  const [title, setTitle] = useState(() =>
    contests.map((contest) => contest.title).join(' · ')
  );
  const [instructions, setInstructions] = useState('');
  const [includeStudents, setIncludeStudents] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;
    async function load() {
      try {
        const response =
          await ClientApis.Contest.getContestAnalysisOverview().send();
        throwBackendError(response);
        if (canceled || 'error' in response) return;
        if (response.enabled) {
          setProfiles(response.profiles);
          setProfileId(
            response.defaultProfileId || response.profiles[0]?.id || ''
          );
        } else {
          setUnavailable(true);
        }
      } catch (cause) {
        if (!canceled)
          setError(cause instanceof Error ? cause.message : t('loadFailed'));
      } finally {
        if (!canceled) setLoading(false);
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [t]);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await ClientApis.Contest.createContestAnalysis({
        tids: contests.map((contest) => contest.docId),
        title: title.trim() || undefined,
        instructions: instructions.trim() || undefined,
        includeStudents,
        profileId: profileId || undefined,
        language,
      }).send();
      throwBackendError(response);
      if (!('error' in response)) onCreated(response.jobId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('createFailed'));
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (open || submitting) return;
        onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs" />
        <Dialog.Content
          className="bg-background fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border p-5 shadow-lg"
          style={{ maxHeight: 'calc(100% - 2rem)' }}
          data-llm-visible="true"
        >
          <Dialog.Title
            className="flex items-center gap-2 text-lg font-semibold"
            data-llm-text={t('dialogTitle', { count: contests.length })}
          >
            <Sparkles aria-hidden="true" className="size-4" />
            {t('dialogTitle', { count: contests.length })}
          </Dialog.Title>
          <Dialog.Description
            className="text-muted-foreground mt-2 text-sm"
            data-llm-text={t('dialogDescription')}
          >
            {t('dialogDescription')}
          </Dialog.Description>

          <div className="mt-4 space-y-4">
            <div className="bg-muted/40 max-h-40 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
              {contests.map((contest) => (
                <div
                  key={contest.docId}
                  className="truncate"
                  title={contest.title}
                >
                  {contest.title}
                </div>
              ))}
            </div>

            {loading ? (
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin"
                />
                {t('loading')}
              </p>
            ) : unavailable ? (
              <p
                className="text-destructive text-sm"
                data-llm-text={t('unavailable')}
              >
                {t('unavailable')}
              </p>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="contest-analysis-model">
                    {t('model')}
                  </FieldLabel>
                  <Select value={profileId} onValueChange={setProfileId}>
                    <SelectTrigger
                      id="contest-analysis-model"
                      className="w-full"
                      disabled={submitting}
                    >
                      <SelectValue placeholder={t('chooseModel')} />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="contest-analysis-title">
                    {t('title')}
                  </FieldLabel>
                  <Input
                    id="contest-analysis-title"
                    value={title}
                    maxLength={100}
                    disabled={submitting}
                    placeholder={t('titlePlaceholder')}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="contest-analysis-instructions">
                    {t('instructions')}
                  </FieldLabel>
                  <Textarea
                    id="contest-analysis-instructions"
                    value={instructions}
                    maxLength={2000}
                    rows={3}
                    disabled={submitting}
                    placeholder={t('instructionsPlaceholder')}
                    onChange={(event) => setInstructions(event.target.value)}
                  />
                </Field>
                <Field orientation="horizontal">
                  <Checkbox
                    id="contest-analysis-students"
                    checked={includeStudents}
                    disabled={submitting}
                    onCheckedChange={(checked) =>
                      setIncludeStudents(checked === true)
                    }
                  />
                  <FieldLabel htmlFor="contest-analysis-students">
                    {t('includeStudents')}
                  </FieldLabel>
                </Field>
              </>
            )}

            <FieldError errors={[error ? { message: error } : undefined]} />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={submitting}
                onClick={() => onClose()}
              >
                <X aria-hidden="true" />
                {tCommon('cancel')}
              </Button>
              <Button
                type="button"
                disabled={submitting || loading || unavailable || !profileId}
                onClick={() => void submit()}
              >
                {submitting ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <Sparkles aria-hidden="true" />
                )}
                {submitting ? t('creating') : t('create')}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
