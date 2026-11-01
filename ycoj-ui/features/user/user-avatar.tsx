import { rewardFrameClasses } from '@/features/rewards/appearance';
import avatarUrl from '@/features/user/lib/avatar-url';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/shared/components/ui/avatar';
import { cn } from '@/shared/lib/utils';
import { BaseUser } from '@/shared/types/user';
import { type ComponentProps } from 'react';

type Props = ComponentProps<typeof Avatar> & {
  user: BaseUser;
};

export default function UserAvatar({ user, className, ...props }: Props) {
  const src = avatarUrl(user.avatar);

  return (
    <Avatar
      {...props}
      className={cn(
        rewardFrameClasses[user.rewardEquipment?.frame ?? ''],
        className
      )}
    >
      {src && <AvatarImage src={src} alt={user.uname} />}
      <AvatarFallback>{user.uname.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
