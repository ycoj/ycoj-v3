import getUsernameColor, { getRatingTier } from './lib/username-color';
import { cn } from '@/shared/lib/utils';
import type { BaseUser } from '@/shared/types/user';

type Props = {
  user: Pick<BaseUser, 'uname' | 'contestRating'>;
  className?: string;
};

export default function Username({ user, className }: Props) {
  const legendary =
    getRatingTier(user.contestRating?.rating) === 'legendaryGrandmaster';
  const [first, ...rest] = Array.from(user.uname);
  return (
    <span className={cn('font-medium', getUsernameColor(user), className)}>
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
