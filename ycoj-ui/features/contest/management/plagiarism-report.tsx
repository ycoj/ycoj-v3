'use client';

import { localizePlagiarismExplanation } from '@/features/contest/management/plagiarism-messages';
import PlagiarismSourceReview from '@/features/contest/management/plagiarism-source-review';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import type {
  PlagiarismPair,
  PlagiarismReport,
} from '@/shared/types/contest-plagiarism';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = { tid: string; jobId: string; report: PlagiarismReport };

export function plagiarismUserName(report: PlagiarismReport, uid: number) {
  const user = report.users[uid];
  return user?.displayName || user?.uname || `#${uid}`;
}

export default function PlagiarismReportView({ tid, jobId, report }: Props) {
  const t = useTranslations('contestManagement.plagiarism');
  const format = useFormatter();
  const [problem, setProblem] = useState('all');
  const [minimum, setMinimum] = useState('0');
  const [selected, setSelected] = useState<PlagiarismPair | null>(null);
  const [reviewNavigation, setReviewNavigation] = useState(0);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const selectedPairButton = useRef<HTMLButtonElement | null>(null);
  const pairs = useMemo(
    () =>
      report.pairs.filter(
        (pair) =>
          (problem === 'all' || pair.pid === Number(problem)) &&
          pair.similarity >= Number(minimum)
      ),
    [minimum, problem, report.pairs]
  );
  const percent = (value: number) =>
    format.number(value / 100, { style: 'percent', maximumFractionDigits: 1 });
  const title = (pid: number) =>
    report.problems.find((entry) => entry.pid === pid)?.title || `#${pid}`;

  useEffect(() => {
    if (!selected) return;
    reviewHeading.current?.focus({ preventScroll: true });
    reviewHeading.current?.scrollIntoView({ block: 'start' });
  }, [reviewNavigation, selected]);

  function returnToPair() {
    selectedPairButton.current?.focus({ preventScroll: true });
    selectedPairButton.current?.scrollIntoView({ block: 'center' });
  }

  return (
    <section className="min-w-0 space-y-6">
      <header className="space-y-2">
        <h2 className="text-lg font-semibold">{t('report')}</h2>
        <p className="text-sm text-muted-foreground">
          {t('summary', {
            participants: report.participantCount,
            submissions: report.submissionCount,
            pairs: report.comparedPairs,
          })}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('generated', {
            date: format.dateTime(new Date(report.generatedAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            }),
            seconds: format.number(report.elapsedMs / 1000, {
              maximumFractionDigits: 1,
            }),
          })}
        </p>
        <p className="max-w-prose text-sm">{t('reviewNotice')}</p>
      </header>
      <div className="flex flex-wrap items-end gap-4">
        <label className="space-y-2 text-sm font-medium">
          <span>{t('problem')}</span>
          <Select
            value={problem}
            onValueChange={(value) => {
              setProblem(value);
              setSelected(null);
            }}
          >
            <SelectTrigger className="w-52" aria-label={t('problem')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allProblems')}</SelectItem>
              {report.problems.map((entry) => (
                <SelectItem key={entry.pid} value={String(entry.pid)}>
                  {entry.title || `#${entry.pid}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-2 text-sm font-medium">
          <span>{t('minimum')}</span>
          <Select
            value={minimum}
            onValueChange={(value) => {
              setMinimum(value);
              setSelected(null);
            }}
          >
            <SelectTrigger className="w-52" aria-label={t('minimum')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">{t('allPairs')}</SelectItem>
              <SelectItem value="50">{t('atLeast', { value: 50 })}</SelectItem>
              <SelectItem value="70">{t('atLeast', { value: 70 })}</SelectItem>
              <SelectItem value="90">{t('atLeast', { value: 90 })}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <p className="py-1 text-sm text-muted-foreground">
          {t('shown', { count: pairs.length })}
        </p>
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden sm:table-cell">
                {t('problem')}
              </TableHead>
              <TableHead>{t('participants')}</TableHead>
              <TableHead className="text-right">{t('similarity')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pairs.map((pair) => (
              <TableRow
                key={`${pair.left.rid}-${pair.right.rid}`}
                data-state={selected === pair ? 'selected' : undefined}
              >
                <TableCell className="hidden max-w-48 whitespace-normal sm:table-cell">
                  {title(pair.pid)}
                </TableCell>
                <TableCell className="max-w-48 break-words whitespace-normal">
                  <span className="mb-1 block text-xs text-muted-foreground sm:hidden">
                    {title(pair.pid)}
                  </span>
                  <span className="block">
                    {plagiarismUserName(report, pair.left.uid)}
                  </span>
                  <span className="block text-muted-foreground">
                    {plagiarismUserName(report, pair.right.uid)}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-semibold">
                    {percent(pair.similarity)}
                  </span>
                  {pair.similarity >= 70 && (
                    <Badge
                      variant="outline"
                      className="ml-2 hidden sm:inline-flex"
                    >
                      {t('reviewMarker')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant={selected === pair ? 'secondary' : 'outline'}
                    aria-label={t('reviewPair', {
                      left: plagiarismUserName(report, pair.left.uid),
                      right: plagiarismUserName(report, pair.right.uid),
                      problem: title(pair.pid),
                    })}
                    onClick={(event) => {
                      selectedPairButton.current = event.currentTarget;
                      setSelected(pair);
                      setReviewNavigation((value) => value + 1);
                    }}
                  >
                    {t('review')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!pairs.length && (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-8 text-center text-muted-foreground"
                >
                  {report.comparedPairs === 0
                    ? t('noPairs')
                    : t('noFilteredPairs')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {selected && (
        <PlagiarismSourceReview
          key={`${selected.left.rid}-${selected.right.rid}`}
          tid={tid}
          jobId={jobId}
          pair={selected}
          leftName={plagiarismUserName(report, selected.left.uid)}
          rightName={plagiarismUserName(report, selected.right.uid)}
          problemTitle={title(selected.pid)}
          headingRef={reviewHeading}
          onReturnToPair={returnToPair}
        />
      )}
      <details className="space-y-3 border-t pt-4">
        <summary className="cursor-pointer text-sm font-medium">
          {t('coverage')}
        </summary>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t('limitations')}
        </p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {report.problems.map((entry) => (
            <li key={entry.pid}>
              {t('problemCoverage', {
                problem: entry.title || `#${entry.pid}`,
                submissions: entry.submissionCount,
                pairs: entry.comparedPairs,
              })}
            </li>
          ))}
        </ul>
        {!!report.skippedSubmissions.length && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {t('skipped', { count: report.skippedSubmissions.length })}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {report.skippedSubmissions.map((submission) => (
                <li key={submission.rid}>
                  {plagiarismUserName(report, submission.uid)} ·{' '}
                  {title(submission.pid)}:{' '}
                  {localizePlagiarismExplanation(submission.reason, t)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </details>
    </section>
  );
}
