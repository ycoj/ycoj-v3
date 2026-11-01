import type { BlogListResponse } from '@/api/server/method/blog';
import {
  blogDetailPath,
  getBlogPublishedAt,
} from '@/features/blog/lib/blog-utils';
import UserSpan from '@/features/user/user-span';
import { Badge } from '@/shared/components/ui/badge';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import { Separator } from '@/shared/components/ui/separator';
import dayjs from 'dayjs';
import { Calendar, Eye, Notebook, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment } from 'react';

type Props = {
  data: BlogListResponse;
};

function formatDate(value: Date | string | undefined) {
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : '';
}

function getPublishedDate(blog: { docId: string }) {
  return getBlogPublishedAt(blog.docId);
}

export default function BlogList({ data }: Props) {
  const t = useTranslations('blog');
  const author = data.udoc;
  if (!data.ddocs.length) {
    return (
      <Empty className="border border-dashed" data-llm-visible="true">
        <EmptyMedia variant="icon">
          <Search strokeWidth={2} />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle data-llm-text={t('empty')}>{t('empty')}</EmptyTitle>
          <EmptyDescription data-llm-text={t('emptyDescription')}>
            {t('emptyDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl border bg-card/40"
      data-llm-visible="true"
    >
      {data.ddocs.map((blog, index) => {
        const publishedDate = getPublishedDate(blog);
        const publishedAt = publishedDate
          ? formatDate(publishedDate)
          : formatDate(blog.updateAt);
        return (
          <Fragment key={blog.docId}>
            <div className="px-4 py-4 transition-colors hover:bg-accent/30 sm:px-5">
              <div data-llm-visible="true" className="flex items-start gap-3">
                <div className="text-muted-foreground hidden w-14 shrink-0 flex-col items-center sm:flex">
                  {publishedDate && (
                    <>
                      <span className="text-foreground text-lg font-semibold tabular-nums">
                        {dayjs(publishedDate).format('DD')}
                      </span>
                      <span className="text-xs">
                        {dayjs(publishedDate).format('YYYY-MM')}
                      </span>
                    </>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link
                    href={blogDetailPath(blog.owner, blog.docId)}
                    prefetch={false}
                    data-llm-text={blog.title}
                    className="text-foreground hover:text-primary block text-sm font-medium hover:underline md:text-base"
                  >
                    {blog.title}
                  </Link>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                    {author && <UserSpan user={author} showAvatar={false} />}
                    {publishedAt && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        <span data-llm-text={publishedAt}>{publishedAt}</span>
                      </span>
                    )}
                    <Badge variant="secondary" title={t('views')}>
                      <Eye data-icon="inline-start" />
                      <span
                        data-llm-text={String(blog.views)}
                        className="tabular-nums"
                      >
                        {blog.views}
                      </span>
                    </Badge>
                    {blog.nReply > 0 && (
                      <Badge variant="secondary" title={t('replies')}>
                        <Notebook data-icon="inline-start" />
                        <span
                          data-llm-text={String(blog.nReply)}
                          className="tabular-nums"
                        >
                          {blog.nReply}
                        </span>
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {index < data.ddocs.length - 1 && <Separator />}
          </Fragment>
        );
      })}
    </div>
  );
}
