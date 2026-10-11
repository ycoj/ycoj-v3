'use client';

import ClientApis from '@/api/client/method';
import { localizePlagiarismExplanation } from '@/features/contest/plagiarism/plagiarism-messages';
import { Button } from '@/shared/components/ui/button';
import { throwBackendError } from '@/shared/lib/backend-response';
import { cn } from '@/shared/lib/utils';
import type {
  PlagiarismMatch,
  PlagiarismPair,
  PlagiarismSource,
} from '@/shared/types/contest-plagiarism';
import { ArrowUp } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';

type Props = {
  tid: string;
  jobId: string;
  pair: PlagiarismPair;
  leftName: string;
  rightName: string;
  problemTitle: string;
  headingRef: Ref<HTMLHeadingElement>;
  onReturnToPair: () => void;
};

type SelectedMatch = { index: number; navigation: number };

type SourcePaneProps = {
  source: PlagiarismSource;
  name: string;
  submittedAt: string;
  matches: PlagiarismMatch[];
  side: 'left' | 'right';
  selectedMatch: SelectedMatch | null;
};

function SourcePane({
  source,
  name,
  submittedAt,
  matches,
  side,
  selectedMatch,
}: SourcePaneProps) {
  const t = useTranslations('contestManagement.plagiarism');
  const format = useFormatter();
  const pane = useRef<HTMLDivElement>(null);
  const selected = selectedMatch === null ? null : matches[selectedMatch.index];
  const startLine = selected?.[`${side}StartLine`];
  const lines = useMemo(
    () =>
      source.code.split(/\r?\n/).map((code, index) => ({
        code,
        number: index + 1,
        highlighted: matches.some(
          (match) =>
            index + 1 >= match[`${side}StartLine`] &&
            index + 1 <= match[`${side}EndLine`]
        ),
      })),
    [matches, side, source.code]
  );

  useEffect(() => {
    if (!startLine || !pane.current) return;
    const line = pane.current.querySelector<HTMLElement>(
      `[data-line="${startLine}"]`
    );
    if (line)
      pane.current.scrollTop +=
        line.getBoundingClientRect().top -
        pane.current.getBoundingClientRect().top;
  }, [selectedMatch?.navigation, startLine]);

  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border"
      aria-label={t('sourceFor', { user: name })}
    >
      <header className="space-y-1 border-b bg-muted/40 px-4 py-3">
        <h4 className="font-medium">{name}</h4>
        <p className="break-all text-xs text-muted-foreground">
          {source.rid} · {source.language}
        </p>
        <p className="text-xs text-muted-foreground">
          {format.dateTime(new Date(submittedAt), {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </p>
      </header>
      <div
        ref={pane}
        tabIndex={0}
        role="region"
        aria-label={t('codeFor', { user: name })}
        className="relative max-h-[36rem] overflow-auto bg-background py-3 font-mono text-xs leading-6 outline-none selection:bg-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <pre className="min-w-max">
          <code>
            {lines.map(({ code: line, number, highlighted }) => {
              const focused =
                selected &&
                number >= selected[`${side}StartLine`] &&
                number <= selected[`${side}EndLine`];
              return (
                <span
                  key={number}
                  data-line={number}
                  className={cn(
                    'block pr-4',
                    highlighted && 'bg-amber-100/70 dark:bg-amber-950/70',
                    focused && 'bg-amber-200 dark:bg-amber-900'
                  )}
                >
                  <span
                    className={cn(
                      'sticky left-0 inline-block w-14 select-none border-r bg-muted pr-3 text-right text-muted-foreground tabular-nums',
                      highlighted &&
                        'bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100',
                      focused && 'bg-amber-200 dark:bg-amber-900'
                    )}
                    aria-label={
                      highlighted
                        ? t('matchedLine', { line: number })
                        : t('line', { line: number })
                    }
                  >
                    {number}
                  </span>
                  <span className="pl-3">{line || ' '}</span>
                  {'\n'}
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </section>
  );
}

export default function PlagiarismSourceReview({
  tid,
  jobId,
  pair,
  leftName,
  rightName,
  problemTitle,
  headingRef,
  onReturnToPair,
}: Props) {
  const t = useTranslations('contestManagement.plagiarism');
  const format = useFormatter();
  const [sources, setSources] = useState<{
    left: PlagiarismSource;
    right: PlagiarismSource;
  } | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selectedMatch, setSelectedMatch] = useState<SelectedMatch | null>(
    null
  );

  useEffect(() => {
    let canceled = false;
    async function load() {
      setError('');
      setSources(null);
      try {
        const [left, right] = await Promise.all([
          ClientApis.Contest.getContestPlagiarismSource(
            tid,
            jobId,
            pair.left.rid
          ).send(),
          ClientApis.Contest.getContestPlagiarismSource(
            tid,
            jobId,
            pair.right.rid
          ).send(),
        ]);
        throwBackendError(left);
        throwBackendError(right);
        if (!canceled && !('error' in left) && !('error' in right))
          setSources({ left, right });
      } catch (cause) {
        if (!canceled)
          setError(
            cause instanceof Error
              ? localizePlagiarismExplanation(cause.message, t)
              : t('sourceFailed')
          );
      }
    }
    void load();
    return () => {
      canceled = true;
    };
  }, [jobId, pair.left.rid, pair.right.rid, retry, t, tid]);

  const percent = (value: number) =>
    format.number(value / 100, { style: 'percent', maximumFractionDigits: 1 });

  return (
    <section
      className="min-w-0 space-y-4 border-t pt-6"
      aria-label={t('sourceReview')}
    >
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="scroll-mt-6 rounded-sm text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {t('pairTitle', {
              left: leftName,
              right: rightName,
              problem: problemTitle,
            })}
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReturnToPair}
          >
            <ArrowUp />
            {t('backToPair')}
          </Button>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {(['token', 'structure', 'fingerprint'] as const).map((score) => (
            <div className="flex gap-2" key={score}>
              <dt className="text-muted-foreground">{t(score)}</dt>
              <dd className="font-medium tabular-nums">
                {percent(pair.scores[score])}
              </dd>
            </div>
          ))}
        </dl>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t('evidenceNotice')}
        </p>
        {!!pair.warnings.length && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {pair.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>
                {t.has(`warnings.${warning}`)
                  ? t(`warnings.${warning}`)
                  : warning}
              </li>
            ))}
          </ul>
        )}
      </header>
      {pair.matches.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            {t('matches', { count: pair.matches.length })}
          </h4>
          <div className="flex max-h-40 flex-wrap gap-2 overflow-auto">
            {pair.matches.map((match, index) => (
              <Button
                type="button"
                key={index}
                size="sm"
                variant={
                  selectedMatch?.index === index ? 'secondary' : 'outline'
                }
                aria-pressed={selectedMatch?.index === index}
                onClick={() =>
                  setSelectedMatch((current) => ({
                    index,
                    navigation: (current?.navigation ?? 0) + 1,
                  }))
                }
              >
                {t('matchRange', {
                  leftStart: match.leftStartLine,
                  leftEnd: match.leftEndLine,
                  rightStart: match.rightStartLine,
                  rightEnd: match.rightEndLine,
                })}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noMatches')}</p>
      )}
      {error ? (
        <div className="flex flex-wrap items-center gap-3">
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRetry((value) => value + 1)}
          >
            {t('retrySource')}
          </Button>
        </div>
      ) : sources ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <SourcePane
            source={sources.left}
            name={leftName}
            submittedAt={pair.left.submittedAt}
            matches={pair.matches}
            side="left"
            selectedMatch={selectedMatch}
          />
          <SourcePane
            source={sources.right}
            name={rightName}
            submittedAt={pair.right.submittedAt}
            matches={pair.matches}
            side="right"
            selectedMatch={selectedMatch}
          />
        </div>
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          {t('loadingSource')}
        </p>
      )}
    </section>
  );
}
