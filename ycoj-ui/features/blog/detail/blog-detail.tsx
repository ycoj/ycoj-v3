import BlogStarButton from './blog-star-button';
import type { BlogDetailResponse } from '@/api/server/method/blog';
import {
  blogEditPath,
  canEditBlog,
  getBlogPublishedAt,
} from '@/features/blog/lib/blog-utils';
import UserSpan from '@/features/user/user-span';
import Markdown from '@/shared/components/markdown';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Separator } from '@/shared/components/ui/separator';
import dayjs from 'dayjs';
import { Calendar, Eye, MessageCircle, Pencil } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type Props = {
  data: BlogDetailResponse;
  uid: number;
  did: string;
  canStar: boolean;
  isSystemEditor: boolean;
};

export default async function BlogDetail({
  data,
  uid,
  did,
  canStar,
  isSystemEditor,
}: Props) {
  const t = await getTranslations('blog');
  const { ddoc, dsdoc, udoc } = data;
  const authorName = udoc?.uname;
  const publishedDate = getBlogPublishedAt(ddoc.docId);
  const publishedAt = publishedDate
    ? dayjs(publishedDate).format('YYYY-MM-DD HH:mm')
    : '';
  const updatedAt = dayjs(ddoc.updateAt).isValid()
    ? dayjs(ddoc.updateAt).format('YYYY-MM-DD HH:mm')
    : '';
  const canEdit = canEditBlog(udoc?._id, ddoc, isSystemEditor);

  return (
    <div className="space-y-4" data-llm-visible="true">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-xs">
                {udoc && authorName ? (
                  <Link
                    href={`/blog/${udoc._id}`}
                    prefetch={false}
                    className="hover:underline"
                  >
                    {t('authorBlog', { name: authorName })}
                  </Link>
                ) : (
                  <span data-llm-text={t('unknownAuthor')}>
                    {t('unknownAuthor')}
                  </span>
                )}
              </p>
              <CardTitle
                className="text-xl leading-snug md:text-2xl"
                data-llm-text={ddoc.title}
              >
                {ddoc.title}
              </CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canStar && (
                <BlogStarButton
                  uid={uid}
                  did={did}
                  starred={Boolean(dsdoc?.star)}
                />
              )}
              {canEdit && (
                <Button variant="outline" asChild>
                  <Link href={blogEditPath(uid, did)} prefetch={false}>
                    <Pencil />
                    {t('edit')}
                  </Link>
                </Button>
              )}
            </div>
          </div>

          <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
            {udoc && <UserSpan user={udoc} />}
            {publishedAt && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3.5" />
                <span data-llm-text={publishedAt}>{publishedAt}</span>
              </span>
            )}
            {updatedAt && updatedAt !== publishedAt && (
              <span title={t('updatedAt')} data-llm-text={updatedAt}>
                {updatedAt}
              </span>
            )}
            <Badge variant="secondary" title={t('views')}>
              <Eye data-icon="inline-start" />
              <span data-llm-text={String(ddoc.views)} className="tabular-nums">
                {ddoc.views}
              </span>
            </Badge>
            <Badge variant="secondary" title={t('replies')}>
              <MessageCircle data-icon="inline-start" />
              <span
                data-llm-text={String(ddoc.nReply)}
                className="tabular-nums"
              >
                {ddoc.nReply}
              </span>
            </Badge>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="pt-4">
          <article className="typo" data-llm-visible="true">
            <Markdown>{ddoc.content}</Markdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
