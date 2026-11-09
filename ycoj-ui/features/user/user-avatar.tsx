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

/**
 * Keeps the avatar image or fallback aligned with an equipped sticker frame.
 * Decorated avatars share the frame's rounded-square corners, while decorations
 * may extend beyond the avatar without intercepting interactions.
 */
export default function UserAvatar({ user, className, ...props }: Props) {
  const src = avatarUrl(user.avatar);
  const frame = user.rewardEquipment?.frame;

  return (
    <Avatar
      {...props}
      className={cn(
        isDecoratedFrame(frame) &&
          'isolate rounded-[28%] after:rounded-[28%] [&>[data-slot=avatar-fallback]]:rounded-[28%] [&>[data-slot=avatar-image]]:rounded-[28%]',
        className
      )}
    >
      {isDecoratedFrame(frame) && <RewardFrameDecoration id={frame} />}
      {src && <AvatarImage src={src} alt={user.uname} />}
      <AvatarFallback>{user.uname.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
