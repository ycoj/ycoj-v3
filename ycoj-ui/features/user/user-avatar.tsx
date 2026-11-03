import { rewardFrameClasses } from '@/features/rewards/appearance';
import RewardFrameDecoration, {
  isDecoratedFrame,
} from '@/features/rewards/reward-frame';
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
  const frame = user.rewardEquipment?.frame;

  return (
    <Avatar
      {...props}
      className={cn(
        rewardFrameClasses[frame ?? ''],
        isDecoratedFrame(frame) && 'isolate',
        className
      )}
    >
      {isDecoratedFrame(frame) && <RewardFrameDecoration id={frame} />}
      {src && <AvatarImage src={src} alt={user.uname} />}
      <AvatarFallback>{user.uname.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
