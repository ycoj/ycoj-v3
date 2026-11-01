'use client';

import ClientApis from '@/api/client/method';
import parseErrorMessage from '@/shared/components/errored/parse-message';
import MarkdownEditor from '@/shared/components/markdown-editor';
import { Button } from '@/shared/components/ui/button';
import { Checkbox } from '@/shared/components/ui/checkbox';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

export type DiscussionFormValues = {
  title: string;
  content: string;
  highlight: boolean;
  pin: boolean;
};

type Props = {
  node: { type: string; name: string };
  /** Back link shown next to Cancel, usually the node listing. */
  backHref: string;
  canHighlight: boolean;
  canPin: boolean;
};

export default function DiscussionCreateForm({
  node,
  backHref,
  canHighlight,
  canPin,
}: Props) {
  const t = useTranslations('discussion.createForm');
  const common = useTranslations('common');
  const router = useRouter();
  const schema = z.object({
    title: z
      .string()
      .trim()
      .min(1, t('titleRequired'))
      .max(64, t('titleTooLong')),
    content: z.string().trim().min(1, t('contentRequired')).max(65535),
    highlight: z.boolean(),
    pin: z.boolean(),
  });
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DiscussionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      content: '',
      highlight: false,
      pin: false,
    },
  });

  const onSubmit = async (values: DiscussionFormValues) => {
    try {
      const response = await ClientApis.Discussion.createDiscussion(
        node.type,
        node.name,
        {
          type: node.type,
          title: values.title,
          content: values.content,
          highlight: canHighlight && values.highlight,
          pin: canPin && values.pin,
        }
      ).send();

      if ('error' in response) {
        setError('root.serverError', {
          type: 'server',
          message:
            (response.error && parseErrorMessage(response.error)) ||
            t('createFailed'),
        });
        return;
      }

      if (response.did) {
        router.push(`/discussion/${response.did}`);
        router.refresh();
        return;
      }

      setError('root.serverError', {
        type: 'server',
        message: t('createFailed'),
      });
    } catch (error) {
      setError('root.serverError', {
        type: 'server',
        message:
          error instanceof Error && error.message
            ? error.message
            : t('createFailed'),
      });
    }
  };

  return (
    <form
      className="space-y-6"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      data-llm-visible="true"
    >
      <Field>
        <FieldLabel htmlFor="title">{t('title')}</FieldLabel>
        <FieldContent>
          <Input
            id="title"
            autoFocus
            placeholder={t('titlePlaceholder')}
            disabled={isSubmitting}
            aria-invalid={!!errors.title}
            {...register('title')}
          />
          <FieldError errors={[errors.title]} />
        </FieldContent>
      </Field>

      <Field>
        <FieldLabel htmlFor="content">{t('content')}</FieldLabel>
        <FieldContent>
          <MarkdownEditor
            id="content"
            disabled={isSubmitting}
            aria-invalid={!!errors.content}
            {...register('content')}
          />
          <FieldError errors={[errors.content]} />
        </FieldContent>
      </Field>

      {(canHighlight || canPin) && (
        <div className="flex flex-wrap gap-6">
          {canHighlight && (
            <Controller
              control={control}
              name="highlight"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="highlight"
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(value === true)}
                    disabled={isSubmitting}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="highlight">{t('highlight')}</Label>
                    <FieldDescription>{t('highlightHelp')}</FieldDescription>
                  </div>
                </div>
              )}
            />
          )}
          {canPin && (
            <Controller
              control={control}
              name="pin"
              render={({ field }) => (
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="pin"
                    checked={field.value}
                    onCheckedChange={(value) => field.onChange(value === true)}
                    disabled={isSubmitting}
                    className="mt-0.5"
                  />
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="pin">{t('pin')}</Label>
                    <FieldDescription>{t('pinHelp')}</FieldDescription>
                  </div>
                </div>
              )}
            />
          )}
        </div>
      )}

      <FieldError errors={[errors.root?.serverError]} />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting} className="gap-1.5">
          <Plus strokeWidth={2} />
          <span data-llm-text={isSubmitting ? t('creating') : t('submit')}>
            {isSubmitting ? t('creating') : t('submit')}
          </span>
        </Button>
        <Button asChild variant="secondary" className="gap-1.5">
          <Link href={backHref} prefetch={false}>
            <ArrowLeft strokeWidth={2} />
            <span data-llm-text={common('cancel')}>{common('cancel')}</span>
          </Link>
        </Button>
      </div>
    </form>
  );
}
