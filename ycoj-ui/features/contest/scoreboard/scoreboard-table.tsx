import {
  getOwnedBalloonColors,
  getProblemBalloonColors,
} from './scoreboard-presentation';
import ScoreboardCell from '@/features/contest/scoreboard/scoreboard-cell';
import RatingChange from '@/features/user/rating/rating-change';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { cn } from '@/shared/lib/utils';
import type { ScoreboardRow } from '@/shared/types/contest';
import type { ProblemDict } from '@/shared/types/problem';
import type { ContestRating } from '@/shared/types/rating';
import type { BaseUserDict } from '@/shared/types/user';
import { useFormatter, useTranslations } from 'next-intl';

type Props = {
  rows: ScoreboardRow[];
  udict: BaseUserDict;
  pdict: ProblemDict;
  tid: string;
  pageType: 'contest' | 'homework';
  currentUid?: number;
  rating?: ContestRating;
};

export default function ScoreboardTable({
  rows,
  udict,
  pdict,
  tid,
  pageType,
  currentUid,
  rating,
}: Props) {
  const t = useTranslations('scoreboard');
  const userT = useTranslations('user');
  const format = useFormatter();
  const ratings = new Map(
    rating?.changes.map((change) => [change.uid, change])
  );
  const showRating = rating?.status === 'settled';
  const headerRow = rows[0];
  const dataRows = rows.slice(1);
  const problemColors = getProblemBalloonColors(headerRow);
  const problemColumns = new Set(
    headerRow.flatMap((node, i) => (node.type === 'problem' ? [i] : []))
  );

  return (
    <Table>
      <TableHeader className="sticky top-0 z-10 bg-background">
        <TableRow>
          {headerRow.map((node, i) => (
            <TableHead
              key={i}
              className={cn(problemColumns.has(i) && 'text-center')}
            >
              <ScoreboardCell
                node={node}
                isHeader
                pdict={pdict}
                tid={tid}
                pageType={pageType}
              />
            </TableHead>
          ))}
          {showRating && (
            <TableHead className="text-right">{t('rating')}</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {dataRows.map((row, i) => {
          const userNode = row.find((n) => n.type === 'user');
          const ownedBalloonColors = getOwnedBalloonColors(row, problemColors);
          const isCurrentUser =
            currentUid != null && userNode?.raw === currentUid;
          const change = ratings.get(Number(userNode?.raw));
          return (
            <TableRow key={i} className={cn(isCurrentUser && 'bg-primary/5')}>
              {row.map((node, j) => (
                <TableCell
                  key={j}
                  className={cn(problemColumns.has(j) && 'text-center')}
                >
                  <ScoreboardCell
                    node={node}
                    udict={udict}
                    pdict={pdict}
                    tid={tid}
                    pageType={pageType}
                    balloonColor={problemColors.get(j)}
                    ownedBalloonColors={
                      node.type === 'user' ? ownedBalloonColors : undefined
                    }
                  />
                </TableCell>
              ))}
              {showRating && (
                <TableCell className="text-right">
                  {change ? (
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="tabular-nums">
                        {format.number(change.after)}{' '}
                        <RatingChange
                          delta={change.delta}
                          className="ml-1 text-xs"
                        />
                      </span>
                      {change.provisional && (
                        <span className="text-muted-foreground text-xs">
                          {userT('ratingProvisional')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
