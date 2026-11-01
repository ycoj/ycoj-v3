import ServerApis from '@/api/server/method';
import DiscussionCreateForm from '@/features/discussion/create/discussion-create-form';
import DiscussionNodeSelect from '@/features/discussion/create/discussion-node-select';
import { getDiscussionNodeContext } from '@/features/discussion/lib/get-discussion-node';
import { discussionNodePath } from '@/features/discussion/lib/node';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import { getUser } from '@/features/user/lib/get-user';
import { Errored } from '@/shared/components/errored';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

type SearchParams = {
  node?: string;
  type?: string;
  name?: string;
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata');
  return { title: t('discussionCreate') };
}

/**
 * Create page for `/discussion/create`.
 *
 * Resource pages link to `/discussion/:type/:name/create`; this route keeps the
 * legacy `?node=` entry working and lets the viewer pick a plain node when the
 * link carries none.
 */
export default async function DiscussionCreatePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await getUser();
  const permissions = resolveDiscussionPermissions(user);
  if (!permissions.canCreate) redirect('/discussion');

  const t = await getTranslations('discussion.createForm');
  const node =
    searchParams.type && searchParams.name
      ? await getDiscussionNodeContext(searchParams.type, searchParams.name)
      : searchParams.node
        ? await getDiscussionNodeContext('node', searchParams.node)
        : null;

  if (searchParams.type && searchParams.name && !node) {
    return (
      <Errored title={t('nodeUnavailable')} error={t('nodeUnavailableHelp')} />
    );
  }

  const list = await ServerApis.Discussion.getDiscussionMain(1);

  if (!node) {
    return (
      <div className="space-y-6" data-llm-visible="true">
        <h1 className="text-lg font-medium" data-llm-text={t('titleHeading')}>
          {t('titleHeading')}
        </h1>
        <p className="text-muted-foreground text-sm">
          <span data-llm-text={t('chooseNode')}>{t('chooseNode')}</span>
        </p>
        <DiscussionNodeSelect nodes={list.vnodes} />
        <Link
          href="/discussion"
          prefetch={false}
          className="text-sm underline"
          data-llm-text={t('backToDiscussion')}
        >
          {t('backToDiscussion')}
        </Link>
      </div>
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
        backHref={discussionNodePath(node.type, node.name)}
        canHighlight={permissions.canHighlight}
        canPin={permissions.canPin}
      />
    </div>
  );
}
