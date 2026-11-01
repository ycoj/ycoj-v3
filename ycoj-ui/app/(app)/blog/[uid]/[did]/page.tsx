import BlogDetail from '@/features/blog/detail/blog-detail';
import { getBlogDetail } from '@/features/blog/get-blog';
import { canEditSystem } from '@/features/manage/manage-access';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
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
  if (uid === null) return { title: t('blogDetail') };

  const data = await getBlogDetail(uid, did);
  if ('error' in data) return { title: t('blogDetail') };
  return { title: data.ddoc.title || t('blogDetail') };
}

export default async function BlogDetailPage({
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

  const [data, user] = await Promise.all([getBlogDetail(uid, did), getUser()]);
  if ('error' in data) {
    return <Errored title={tError('unavailable')} error={data.error} />;
  }

  return (
    <BlogDetail
      data={data}
      uid={uid}
      did={did}
      canStar={Boolean(user && hasPriv(user, PRIV.PRIV_USER_PROFILE))}
      isSystemEditor={canEditSystem(user ?? { priv: 0 })}
    />
  );
}
