import DiscussionCreateForm from '@/features/discussion/create/discussion-create-form';
import { getDiscussionNodeContext } from '@/features/discussion/lib/get-discussion-node';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound, redirect } from 'next/navigation';

type Params = {
  did: string;
  name: string;
};

const NODE_TYPES = new Set(['problem', 'contest', 'training', 'homework']);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('discussionCreate') };
}

/**
 * Create a topic inside a resource node: `/discussion/:type/:name/create`,
 * the counterpart of the legacy `/discuss/:type/:name/create`.
 */
export default async function DiscussionNodeCreatePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { did: type, name } = await params;
  if (!NODE_TYPES.has(type)) notFound();

  const user = await getUser();
  const permissions = resolveDiscussionPermissions(user);
  if (!permissions.canCreate) redirect(`/discussion/${type}/${name}`);

  const t = await getTranslations('discussion.createForm');
  const node = await getDiscussionNodeContext(type, name);
  if (!node) {
    return (
      <Errored title={t('nodeUnavailable')} error={t('nodeUnavailableHelp')} />
    );
  }

  return (
    <div className="space-y-6" data-llm-visible="true">
      <div className="space-y-1">
        <h1 className="text-lg font-medium" data-llm-text={t('titleHeading')}>
          {t('titleHeading')}
        </h1>
        <p className="text-muted-foreground text-sm">
          <span data-llm-text={node.title}>{node.title}</span>
        </p>
      </div>
      <DiscussionCreateForm
        node={node}
        backHref={`/discussion/${type}/${encodeURIComponent(name)}`}
        canHighlight={permissions.canHighlight}
        canPin={permissions.canPin}
      />
    </div>
  );
}
