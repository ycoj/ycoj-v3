import { getDiscussionDetail } from '@/features/discussion/detail/get-discussion-detail';
import DiscussionEditForm from '@/features/discussion/edit/discussion-edit-form';
import { canEditTopic } from '@/features/discussion/lib/permissions';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import { getUser } from '@/features/user/lib/get-user';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';

type Params = {
  did: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { did } = await params;
  const data = await getDiscussionDetail(did);
  const t = await getTranslations('metadata');
  return {
    title: `${data.ddoc.title} - ${t('discussionEdit')}`,
  };
}

export default async function DiscussionEditPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { did } = await params;
  const [data, user] = await Promise.all([getDiscussionDetail(did), getUser()]);
  const permissions = resolveDiscussionPermissions(user);

  if (!canEditTopic(permissions, user?._id, data.ddoc.owner)) {
    redirect(`/discussion/${did}`);
  }

  return (
    <div className="space-y-6" data-llm-visible="true">
      <h1 className="text-lg font-medium" data-llm-text={data.ddoc.title}>
        {data.ddoc.title}
      </h1>
      <DiscussionEditForm
        ddoc={data.ddoc}
        canHighlight={permissions.canHighlight}
        canPin={permissions.canPin}
      />
    </div>
  );
}
