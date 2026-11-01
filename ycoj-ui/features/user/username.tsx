import getUsernameColor, {
  getRatingTier,
  isUsernameAdmin,
} from './lib/username-color';
import { rewardBackgroundClasses } from '@/features/rewards/appearance';
import { cn } from '@/shared/lib/utils';
import type { BaseUser } from '@/shared/types/user';

type Props = {
  user: Pick<BaseUser, 'uname' | 'contestRating' | 'priv' | 'rewardEquipment'>;
  className?: string;
};

export default function Username({ user, className }: Props) {
  const legendary =
    !isUsernameAdmin(user) &&
    getRatingTier(user.contestRating?.rating) === 'legendaryGrandmaster';
  const [first, ...rest] = Array.from(user.uname);
  return (
    <span
      className={cn(
        'font-medium',
        rewardBackgroundClasses[user.rewardEquipment?.background ?? ''],
        getUsernameColor(user),
        className
      )}
    >
      {legendary ? (
        <>
          <span className="text-foreground">{first}</span>
          {rest.join('')}
        </>
      ) : (
        user.uname
      )}
    </span>
  );
}
