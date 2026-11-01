import { getBlogList } from '@/features/blog/get-blog';
import {
  blogCreatePath,
  blogListPath,
  canCreateBlog,
} from '@/features/blog/lib/blog-utils';
import BlogList from '@/features/blog/list/blog-list';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import Pagination from '@/shared/components/pagination';
import { Button } from '@/shared/components/ui/button';
import TwoColumnLayout from '@/shared/layout/two-column';
import { Plus } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

type Params = { uid: string };
type SearchParams = { page?: string };

function parseUid(value: string) {
  const uid = Number.parseInt(value, 10);
  return Number.isSafeInteger(uid) && uid > 0 ? uid : null;
}

function parsePage(value?: string) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { uid: uidParam } = await params;
  const uid = parseUid(uidParam);
  const t = await getTranslations('metadata');
  if (uid === null) return { title: t('blogList') };

  const data = await getBlogList(uid);
  if ('error' in data || !data.udoc) return { title: t('blogList') };
  return { title: `${data.udoc.uname} - ${t('blogList')}` };
}

export default async function BlogListPage({
  params,
  searchParams: searchParamsPromise,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { uid: uidParam } = await params;
  const searchParams = await searchParamsPromise;
  const uid = parseUid(uidParam);
  const tError = await getTranslations('error');
  const t = await getTranslations('blog');

  if (uid === null) {
    return <Errored title={tError('unavailable')} error={t('invalidAuthor')} />;
  }

  const [data, user] = await Promise.all([
    getBlogList(uid, parsePage(searchParams.page)),
    getUser(),
  ]);
  if ('error' in data) {
    return <Errored title={tError('unavailable')} error={data.error} />;
  }
  if (!data.udoc) {
    return <Errored title={tError('unavailable')} error={t('notFound')} />;
  }

  const listHref = blogListPath(uid);
  const canCreate = canCreateBlog(user?._id, uid);
  const heading = t('title', { name: data.udoc.uname });

  return (
    <TwoColumnLayout
      ratio="8-2"
      left={
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold" data-llm-text={heading}>
            {heading}
          </h1>
          <BlogList data={data} />
          <Pagination page={data.page} totalPages={data.dpcount} />
        </div>
      }
      right={
        <div className="space-y-4" data-llm-visible="true">
          <div className="rounded-xl border bg-card/40 p-4 text-sm">
            <p className="font-medium" data-llm-text={data.udoc.uname}>
              {data.udoc.uname}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {t('postCount', { count: data.dpcount })}
            </p>
          </div>
          {canCreate && (
            <Button asChild className="w-full">
              <Link href={blogCreatePath(uid)} prefetch={false}>
                <Plus />
                <span data-llm-text={t('create')}>{t('create')}</span>
              </Link>
            </Button>
          )}
          <p className="text-muted-foreground text-xs">
            <Link href={listHref} prefetch={false} className="hover:underline">
              {t('title', { name: data.udoc.uname })}
            </Link>
          </p>
        </div>
      }
    />
  );
}
