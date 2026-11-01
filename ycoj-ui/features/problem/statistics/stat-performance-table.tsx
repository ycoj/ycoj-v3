import type { ProblemStatRecord } from '@/api/server/method/problems/statistics';
import UserSpan from '@/features/user/user-span';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { formatRecordTime } from '@/shared/lib/format-time';
import { formatMemory, formatTime } from '@/shared/lib/format-units';
import oid2ts from '@/shared/lib/oid2ts';
import type { BaseUserDict } from '@/shared/types/user';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type Props = {
  records: ProblemStatRecord[];
  users: BaseUserDict;
  languageNames: Record<string, string>;
};

/**
 * Performance table for accepted submissions.
 *
 * `record.stat` stores only the metrics needed for this list, so every row is
 * an accepted record and the status column links to its detail page.
 */
export default function StatPerformanceTable({
  records,
  users,
  languageNames,
}: Props) {
  const t = useTranslations('problemOps.stats');

  return (
    <Table className="table-fixed" data-llm-visible="true">
      <colgroup>
        <col className="w-20 md:w-28" />
        <col />
        <col className="w-24" />
        <col className="w-24" />
        <col className="hidden w-28 md:table-column" />
        <col className="hidden w-20 md:table-column" />
        <col className="hidden w-32 md:table-column" />
      </colgroup>
      <TableHeader>
        <TableRow>
          <TableCell>{t('columns.status')}</TableCell>
          <TableCell>{t('columns.submitter')}</TableCell>
          <TableCell className="text-center">{t('columns.time')}</TableCell>
          <TableCell className="text-center">{t('columns.memory')}</TableCell>
          <TableCell className="hidden md:table-cell">
            {t('columns.language')}
          </TableCell>
          <TableCell className="hidden text-center md:table-cell">
            {t('columns.length')}
          </TableCell>
          <TableCell className="hidden text-center md:table-cell">
            {t('columns.submittedAt')}
          </TableCell>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => {
          const user = users[record.uid];
          const language = languageNames[record.lang] ?? record.lang;

          return (
            <TableRow key={record._id}>
              <TableCell>
                <Link
                  href={`/record/${record._id}`}
                  prefetch={false}
                  className="font-medium text-green-600 hover:underline dark:brightness-150"
                  data-llm-text={t('statusValues.AC')}
                >
                  {t('statusValues.AC')}
                </Link>
              </TableCell>
              <TableCell className="text-right">
                {user ? (
                  <div className="flex justify-end">
                    <UserSpan user={user} showAvatar />
                  </div>
                ) : (
                  record.uid
                )}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {record.time ? formatTime(record.time, 'ms') : '-'}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                {record.memory ? formatMemory(record.memory) : '-'}
              </TableCell>
              <TableCell className="hidden md:table-cell">{language}</TableCell>
              <TableCell className="hidden text-center tabular-nums md:table-cell">
                {record.length ? `${record.length} B` : '-'}
              </TableCell>
              <TableCell className="hidden text-center md:table-cell">
                {formatRecordTime(oid2ts(record._id))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
