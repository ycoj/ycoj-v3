import type {
  RankingSort,
  RankingUser,
} from '@/api/server/method/ranking/list';
import UserSpan from '@/features/user/user-span';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/components/ui/empty';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type { RpInfo } from '@/shared/types/user';
import { Users } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';

/** RP category key -> display label (Problems, Contests, etc.) */
const RP_CATEGORIES: Array<keyof RpInfo> = ['problem', 'contest'];

type Props = {
  udocs: RankingUser[];
  page: number;
  pageSize: number;
  sort?: RankingSort;
};

function formatRp(value: number | undefined): string {
  if (value === undefined) return '-';
  return String(Math.round(value));
}

export default function RankingLeaderboard({
  udocs,
  page,
  pageSize,
  sort = 'rp',
}: Props) {
  const t = useTranslations('ranking');
  const common = useTranslations('common');
  const format = useFormatter();
  const ratingSort = sort === 'rating';
  if (!udocs.length) {
    return (
      <Empty className="border border-dashed" data-llm-visible="true">
        <EmptyMedia variant="icon">
          <Users strokeWidth={2} />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle
            data-llm-text={t(ratingSort ? 'noRatedUsers' : 'noUsers')}
          >
            {t(ratingSort ? 'noRatedUsers' : 'noUsers')}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Table className="table-fixed" data-llm-visible="true">
      <colgroup>
        <col className="w-14" />
        <col className="w-32 md:w-40" />
        <col className={ratingSort ? 'w-24' : 'w-16'} />
        {!ratingSort &&
          RP_CATEGORIES.map((key) => (
            <col key={key} className="w-16 hidden lg:table-column" />
          ))}
        <col className="w-16" />
        <col className="hidden md:table-column" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableCell className="font-medium">#</TableCell>
          <TableCell className="font-medium">{common('user')}</TableCell>
          <TableCell className="font-medium text-center">{t(sort)}</TableCell>
          {!ratingSort &&
            RP_CATEGORIES.map((key) => (
              <TableCell
                key={key}
                className="hidden text-center font-medium lg:table-cell"
              >
                {t(`category.${key}`)}
              </TableCell>
            ))}
          <TableCell className="text-center font-medium">
            {t('accepted')}
          </TableCell>
          <TableCell className="hidden font-medium md:table-cell">
            {t('bio')}
          </TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {udocs.map((user, index) => {
          const rank = (page - 1) * pageSize + index + 1;
          return (
            <TableRow key={user._id}>
              <TableCell data-llm-text={String(rank)}>{rank}</TableCell>
              <TableCell>
                <UserSpan user={user} />
              </TableCell>
              <TableCell
                className="text-center"
                data-llm-text={
                  ratingSort
                    ? user.contestRating
                      ? String(user.contestRating.rating)
                      : '—'
                    : String(user.rp)
                }
              >
                {ratingSort ? (
                  <div className="space-y-0.5 tabular-nums">
                    <span className="font-medium">
                      {user.contestRating
                        ? format.number(user.contestRating.rating)
                        : '—'}
                    </span>
                    {user.contestRating?.provisional && (
                      <span className="block text-xs text-muted-foreground">
                        {t('provisional')}
                      </span>
                    )}
                  </div>
                ) : (
                  formatRp(user.rp)
                )}
              </TableCell>
              {!ratingSort &&
                RP_CATEGORIES.map((key) => (
                  <TableCell
                    key={key}
                    className="hidden text-center lg:table-cell"
                    data-llm-text={formatRp(user.rpInfo?.[key])}
                  >
                    {formatRp(user.rpInfo?.[key])}
                  </TableCell>
                ))}
              <TableCell
                className="text-center tabular-nums"
                data-llm-text={String(user.nAccept ?? 0)}
              >
                {user.nAccept ?? 0}
              </TableCell>
              <TableCell className="hidden max-w-48 truncate text-muted-foreground text-sm md:table-cell">
                {user.bio ?? ''}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
