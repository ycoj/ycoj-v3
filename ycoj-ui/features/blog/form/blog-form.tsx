'use client';

import {
  BLOG_TITLE_MAX_LENGTH,
  buildBlogPayload,
  validateBlogValues,
  type BlogFormValues,
} from '../lib/blog-utils';
import MarkdownEditor from '@/shared/components/markdown-editor';
import { Button } from '@/shared/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/shared/components/ui/field';
import { Input } from '@/shared/components/ui/input';
import { LoaderCircle, Save, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';

type Props = {
  mode: 'create' | 'edit';
  defaultValues: BlogFormValues;
  /** Resolves to the detail page to open after a successful write. */
  onSubmit: (values: BlogFormValues) => Promise<string>;
  cancelHref: string;
  extraActions?: (isSubmitting: boolean) => ReactNode;
};

export default function BlogForm({
  mode,
  defaultValues,
  onSubmit,
  cancelHref,
  extraActions,
}: Props) {
  const t = useTranslations('blog');
  const router = useRouter();
  const heading = t(mode === 'create' ? 'createTitle' : 'editTitle');

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BlogFormValues>({
    defaultValues,
  });

  const handleFormSubmit = async (values: BlogFormValues) => {
    // The browser's `required` attribute is not enough: the editor keeps
    // whitespace-only text, which the backend rejects as an invalid Content.
    const validation = validateBlogValues(values, {
      titleRequired: t('titleRequired'),
      titleTooLong: t('titleTooLong'),
      contentRequired: t('contentRequired'),
    });
    if (validation.title) {
      setError('title', { message: validation.title });
      return;
    }
    if (validation.content) {
      setError('content', { message: validation.content });
      return;
    }

    try {
      const path = await onSubmit(buildBlogPayload(values));
      router.push(path);
      router.refresh();
    } catch (error) {
      setError('root.serverError', {
        message:
          error instanceof Error && error.message
            ? error.message
            : t('submitFailed'),
      });
    }
  };

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      className="space-y-5"
      data-llm-visible="true"
    >
      <h1 className="text-2xl font-semibold" data-llm-text={heading}>
        {heading}
      </h1>

      <Field>
        <FieldLabel htmlFor="blog-title">{t('title')}</FieldLabel>
        <Input
          id="blog-title"
          placeholder={t('titlePlaceholder')}
          maxLength={BLOG_TITLE_MAX_LENGTH}
          disabled={isSubmitting}
          aria-invalid={!!errors.title}
          {...register('title')}
        />
        <FieldError errors={[errors.title]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="blog-content">{t('content')}</FieldLabel>
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              id="blog-content"
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={async (event) => field.onChange(event.target.value)}
              onBlur={async () => field.onBlur()}
              disabled={isSubmitting}
              aria-invalid={!!errors.content}
            />
          )}
        />
        <FieldError errors={[errors.content]} />
      </Field>

      {errors.root?.serverError && (
        <FieldError errors={[errors.root.serverError]} />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <LoaderCircle className="animate-spin" />
          ) : mode === 'edit' ? (
            <Save />
          ) : (
            <Send />
          )}
          <span data-llm-text={isSubmitting ? t('saving') : t('save')}>
            {isSubmitting ? t('saving') : t('save')}
          </span>
        </Button>
        {extraActions?.(isSubmitting)}
        <Button variant="outline" asChild>
          <Link href={cancelHref} prefetch={false}>
            {t('cancel')}
          </Link>
        </Button>
      </div>
    </form>
  );
}
