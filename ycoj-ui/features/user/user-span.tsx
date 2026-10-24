import CcfHook from '@/features/user/ccf-hook';
import UserAvatar from '@/features/user/user-avatar';
import Username from '@/features/user/username';
import { BaseUser } from '@/shared/types/user';
import Link from 'next/link';

type Props = {
  user: BaseUser;
  showAvatar?: boolean;
};

export default function UserSpan({ user, showAvatar = true }: Props) {
  return (
    <Link href={`/user/${user._id}`} prefetch={false} className="no-underline">
      <span className="inline-flex items-center gap-2 align-middle text-sm text-gray-500">
        {showAvatar && <UserAvatar user={user} size="sm" />}
        <span className="inline-flex min-w-0 items-center gap-0.5">
          <Username user={user} />
          <CcfHook level={user.ccfLevel} />
        </span>
      </span>
    </Link>
  );
}
