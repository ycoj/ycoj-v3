import DiscussionRepliesClient from '@/features/discussion/detail/discussion-replies-client';
import { resolveDiscussionPermissions } from '@/features/discussion/lib/permissions';
import { getUser } from '@/features/user/lib/get-user';
import type {
  DiscussionDoc,
  DiscussionReplyDoc,
} from '@/shared/types/discussion';
import type { BaseUser, BaseUserDict } from '@/shared/types/user';

type Props = {
  did: string;
  ddoc: DiscussionDoc;
  drdocs: DiscussionReplyDoc[];
  udict: BaseUserDict;
  page: number;
  pcount: number;
  reactions: Record<string, Record<string, number>>;
};

export default async function DiscussionReplies({
  did,
  ddoc,
  drdocs,
  udict,
  page,
  pcount,
  reactions,
}: Props) {
  const user = await getUser();
  const permissions = resolveDiscussionPermissions(user);
  const currentUser: BaseUser | null = user
    ? {
        _id: user._id,
        uname: user.uname,
        mail: user.mail,
        avatar: user.avatar,
      }
    : null;

  return (
    <DiscussionRepliesClient
      did={did}
      drdocs={drdocs}
      udict={udict}
      page={page}
      pcount={pcount}
      currentUser={currentUser}
      viewerId={user?._id}
      permissions={permissions}
      topicOwner={ddoc.owner}
      topicLocked={!!ddoc.lock}
      reactions={reactions}
    />
  );
}
