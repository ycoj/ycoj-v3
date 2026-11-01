import BlogCreateForm from '@/features/blog/create/blog-create-form';
import { canCreateBlog } from '@/features/blog/lib/blog-utils';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

type Params = { uid: string };

function parseUid(value: string) {
  const uid = Number.parseInt(value, 10);
  return Number.isSafeInteger(uid) && uid > 0 ? uid : null;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('editBlog') };
}

export default async function BlogCreatePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { uid: uidParam } = await params;
  const uid = parseUid(uidParam);
  const tError = await getTranslations('error');
  const t = await getTranslations('blog');
  const user = await getUser();

  if (uid === null) {
    return <Errored title={tError('unavailable')} error={t('invalidAuthor')} />;
  }
  if (!canCreateBlog(user?._id, uid)) {
    return <Errored title={tError('unavailable')} error={t('noPermission')} />;
  }

  return <BlogCreateForm uid={uid} />;
}
