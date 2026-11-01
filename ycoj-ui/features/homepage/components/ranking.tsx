import RecentSectionCard from './recent-section-card';
import type {
  HomepageUser,
  HomepageUserDict,
} from '@/api/server/method/ui/homepage';
import UserSpan from '@/features/user/user-span';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/shared/components/ui/table';
import { useTranslations } from 'next-intl';
import removeMd from 'remove-markdown';

type Props = {
  /** Ordered user ids from the backend, highest rank first. */
  uids: number[];
  udict: HomepageUserDict;
};

function bioText(bio: HomepageUser['bio']): string {
  if (!bio) return '';
  return removeMd(bio, {
    stripListLeaders: true,
    listUnicodeChar: '',
    gfm: true,
    useImgAltText: true,
  })
    .replace(/\s+/g, ' ')
    .trim();
}

export default function RankingSection({ uids, udict }: Props) {
  const t = useTranslations('homepage');
  const visible = uids
    .map((uid) => ({ uid, user: udict[uid] }))
    .filter((entry): entry is { uid: number; user: HomepageUser } =>
      Boolean(entry.user)
    );
  if (!visible.length) return null;

  return (
    <RecentSectionCard title={t('ranking')} href="/ranking">
      <Table className="table-fixed text-xs md:text-sm" data-llm-visible="true">
        <TableBody>
          {visible.map(({ uid, user }, index) => {
            const bio = bioText(user.bio);
            return (
              <TableRow key={uid}>
                <TableCell
                  className="text-muted-foreground w-8 tabular-nums"
                  data-llm-text={String(index + 1)}
                >
                  {index + 1}
                </TableCell>
                <TableCell className="min-w-0">
                  <div className="truncate">
                    <UserSpan user={user} />
                  </div>
                </TableCell>
                <TableCell
                  className="w-16 text-right tabular-nums"
                  data-llm-text={String(user.rp ?? 0)}
                >
                  {Math.round(user.rp ?? 0)}
                </TableCell>
                {bio && (
                  <TableCell
                    className="text-muted-foreground hidden max-w-40 truncate lg:table-cell"
                    title={bio}
                    data-llm-text={
                      bio.length > 64 ? `${bio.slice(0, 64)}…` : bio
                    }
                  >
                    {bio.length > 64 ? `${bio.slice(0, 64)}…` : bio}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </RecentSectionCard>
  );
}
