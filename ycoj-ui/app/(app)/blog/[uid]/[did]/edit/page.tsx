import BlogEditForm from '@/features/blog/edit/blog-edit-form';
import { getBlogEdit } from '@/features/blog/get-blog';
import { canEditBlog } from '@/features/blog/lib/blog-utils';
import { canEditSystem } from '@/features/manage/manage-access';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = { uid: string; did: string };

function parseUid(value: string) {
  const uid = Number.parseInt(value, 10);
  return Number.isSafeInteger(uid) && uid > 0 ? uid : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { uid: uidParam, did } = await params;
  const uid = parseUid(uidParam);
  const t = await getTranslations('metadata');
  if (uid === null) return { title: t('editBlog') };

  const data = await getBlogEdit(uid, did);
  if ('error' in data) return { title: t('editBlog') };
  return { title: `${data.ddoc.title} - ${t('editBlog')}` };
}

export default async function BlogEditPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { uid: uidParam, did } = await params;
  const uid = parseUid(uidParam);
  const tError = await getTranslations('error');
  const t = await getTranslations('blog');

  if (uid === null) {
    return <Errored title={tError('unavailable')} error={t('invalidAuthor')} />;
  }

  const [data, user] = await Promise.all([getBlogEdit(uid, did), getUser()]);
  if ('error' in data) {
    return <Errored title={tError('unavailable')} error={data.error} />;
  }
  if (!canEditBlog(user?._id, data.ddoc, canEditSystem(user ?? { priv: 0 }))) {
    return <Errored title={tError('unavailable')} error={t('noPermission')} />;
  }

  return <BlogEditForm key={data.ddoc.docId} uid={uid} blog={data.ddoc} />;
}
