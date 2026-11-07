'use client';

import { getContestStatusTextClassName } from '@/features/contest/contest-status';
import RewardTitle from '@/features/rewards/reward-title';
import CcfHook from '@/features/user/ccf-hook';
import UserAvatar from '@/features/user/user-avatar';
import Username from '@/features/user/username';
import type {
  ContestPreview,
  EntityPreview,
  EntityPreviewChrome,
  EntityPreviewResult,
  HomeworkPreview,
  ProblemPreview,
  ScheduleStatus,
  TrainingPreview,
  UserPreview,
} from '@/shared/components/entity-hover/types';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { PROBLEMS_DIFFICULTY_KEYS } from '@/shared/configs/difficulty';
import { cn } from '@/shared/lib/utils';
import type { BaseUser } from '@/shared/types/user';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const CONTEST_RULES = [
  'acm',
  'oi',
  'ioi',
  'ledo',
  'homework',
  'strictioi',
] as const;

type ContestRuleName = (typeof CONTEST_RULES)[number];

const whenOptions = {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const;

function isContestRule(rule: string): rule is ContestRuleName {
  return (CONTEST_RULES as readonly string[]).includes(rule);
}

function formatWhen(value: string, locale: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, whenOptions).format(date);
}

function StatusLabel({ status }: { status: ScheduleStatus }) {
  const t = useTranslations('contest.status');
  const label = t(status);
  return (
    <span
      className={getContestStatusTextClassName(status)}
      data-llm-text={label}
    >
      {label}
    </span>
  );
}

function RuleLabel({ rule }: { rule: string }) {
  const t = useTranslations('contest.rule');
  if (!isContestRule(rule)) return rule;
  const label = t(rule);
  return <span data-llm-text={label}>{label}</span>;
}

function DifficultyLabel({ difficulty }: { difficulty: number }) {
  const t = useTranslations('difficulty');
  const level = difficulty >= 1 && difficulty <= 8 ? difficulty : 0;
  const label = t(PROBLEMS_DIFFICULTY_KEYS[level]);
  return <span data-llm-text={label}>{label}</span>;
}

function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground text-xs leading-5">{children}</p>;
}

function Title({ children }: { children: string }) {
  return (
    <p
      className="mt-0.5 line-clamp-2 font-medium leading-snug"
      data-llm-text={children}
    >
      {children}
    </p>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground mt-1.5 text-xs">{children}</p>;
}

function ProblemCard({ preview }: { preview: ProblemPreview }) {
  const t = useTranslations('hoverCard');
  const misc = useTranslations('misc');
  const stats = t('stats', {
    accepted: preview.nAccept,
    submitted: preview.nSubmit,
  });
  return (
    <>
      <Kicker>
        <span className="tabular-nums" data-llm-text={preview.pid}>
          {preview.pid}
        </span>
        {' · '}
        <DifficultyLabel difficulty={preview.difficulty} />
        {preview.hidden ? ` ${misc('hidden')}` : null}
      </Kicker>
      <Title>{preview.title}</Title>
      {preview.tags.length > 0 && (
        <p
          className="text-muted-foreground mt-1 line-clamp-1 text-xs"
          data-llm-text={preview.tags.join(' · ')}
        >
          {preview.tags.join(' · ')}
        </p>
      )}
      <Meta>
        <span className="tabular-nums" data-llm-text={stats}>
          {stats}
        </span>
      </Meta>
    </>
  );
}

function ContestCard({ preview }: { preview: ContestPreview }) {
  const t = useTranslations('hoverCard');
  const contest = useTranslations('contest');
  const common = useTranslations('common');
  const locale = useLocale();
  const begin = formatWhen(preview.beginAt, locale);
  const end = formatWhen(preview.endAt, locale);
  const counts = `${t('participants', { count: preview.attend })} · ${common('problems', { count: preview.problemCount })}`;
  return (
    <>
      <Kicker>
        <StatusLabel status={preview.status} />
        {preview.rule ? (
          <>
            {' · '}
            <RuleLabel rule={preview.rule} />
          </>
        ) : null}
        {preview.rated ? ` · ${contest('rated')}` : null}
      </Kicker>
      <Title>{preview.title}</Title>
      {begin && end && (
        <Meta>
          <span data-llm-text={`${begin} – ${end}`}>
            {begin} – {end}
          </span>
        </Meta>
      )}
      <Meta>
        <span data-llm-text={counts}>{counts}</span>
      </Meta>
    </>
  );
}

function HomeworkCard({ preview }: { preview: HomeworkPreview }) {
  const t = useTranslations('hoverCard');
  const common = useTranslations('common');
  const locale = useLocale();
  const deadline = formatWhen(preview.deadline, locale);
  const due = deadline ? t('deadline', { time: deadline }) : null;
  const counts = `${t('participants', { count: preview.attend })} · ${common('problems', { count: preview.problemCount })}`;
  return (
    <>
      <Kicker>
        <StatusLabel status={preview.status} />
      </Kicker>
      <Title>{preview.title}</Title>
      {due && (
        <Meta>
          <span data-llm-text={due}>{due}</span>
        </Meta>
      )}
      <Meta>
        <span data-llm-text={counts}>{counts}</span>
      </Meta>
    </>
  );
}

function TrainingCard({ preview }: { preview: TrainingPreview }) {
  const t = useTranslations('hoverCard');
  const common = useTranslations('common');
  const counts = `${common('sections', { count: preview.sectionCount })} · ${common('problems', { count: preview.problemCount })}`;
  const progress =
    preview.enrolled && preview.progress !== null
      ? t('progress', { percent: preview.progress })
      : null;
  const foot = progress
    ? `${t('participants', { count: preview.attend })} · ${progress}`
    : t('participants', { count: preview.attend });
  return (
    <>
      <Title>{preview.title}</Title>
      {preview.excerpt ? (
        <p
          className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed"
          data-llm-text={preview.excerpt}
        >
          {preview.excerpt}
        </p>
      ) : null}
      <Meta>
        <span data-llm-text={counts}>{counts}</span>
      </Meta>
      <p className="text-muted-foreground mt-1 text-xs" data-llm-text={foot}>
        {foot}
      </p>
    </>
  );
}

function userForPreview(preview: UserPreview): BaseUser {
  return {
    _id: Number(preview.id),
    uname: preview.uname,
    mail: '',
    avatar: preview.avatar,
    priv: preview.priv,
    ccfLevel: preview.ccfLevel,
    rewardEquipment: preview.equipment,
    contestRating:
      preview.rating === null
        ? null
        : {
            rating: preview.rating,
            peak: preview.rating,
            contests: 0,
            provisional: false,
          },
  };
}

function UserRole({ role }: { role: string }) {
  const t = useTranslations('hoverCard');
  if (role === 'guest') return t('roleGuest');
  if (role === 'root') return t('roleRoot');
  return role;
}

function UserCard({ preview }: { preview: UserPreview }) {
  const t = useTranslations('hoverCard');
  const user = userForPreview(preview);
  const role = preview.role ? <UserRole role={preview.role} /> : null;
  const badge = preview.badge;
  const stats = [t('solved', { count: preview.nAccept })];
  if (preview.rating !== null)
    stats.push(t('rating', { rating: preview.rating }));
  else if (preview.rank !== null) stats.push(t('rank', { rank: preview.rank }));
  const summary = stats.join(' · ');
  return (
    <>
      <div className="flex min-w-0 items-start gap-2.5">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1">
            <Username user={user} />
            <CcfHook level={preview.ccfLevel} />
            {preview.equipment.title ? (
              <RewardTitle id={preview.equipment.title} />
            ) : null}
          </p>
          {preview.displayName ? (
            <p
              className="text-muted-foreground truncate text-xs"
              data-llm-text={preview.displayName}
            >
              {preview.displayName}
            </p>
          ) : null}
          {role || badge ? (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {role}
              {role && badge ? ' · ' : null}
              {badge}
            </p>
          ) : null}
        </div>
      </div>
      {preview.bio ? (
        <p
          className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed"
          data-llm-text={preview.bio}
        >
          {preview.bio}
        </p>
      ) : null}
      <Meta>
        <span className="tabular-nums" data-llm-text={summary}>
          {summary}
        </span>
      </Meta>
    </>
  );
}

function PreviewBody({ preview }: { preview: EntityPreview }) {
  switch (preview.kind) {
    case 'problem':
      return <ProblemCard preview={preview} />;
    case 'contest':
      return <ContestCard preview={preview} />;
    case 'homework':
      return <HomeworkCard preview={preview} />;
    case 'training':
      return <TrainingCard preview={preview} />;
    case 'user':
      return <UserCard preview={preview} />;
    default: {
      const unexpected: never = preview;
      return unexpected;
    }
  }
}

function PreviewLoading({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export const entityPreviewCardClassName =
  'bg-popover text-popover-foreground w-64 rounded-lg p-3 text-sm shadow-md ring-1 ring-foreground/10';

export default function EntityPreviewCard({
  result,
  chrome,
}: {
  result: EntityPreviewResult | null;
  chrome?: EntityPreviewChrome;
}) {
  const t = useTranslations('hoverCard');
  const message = result && !result.ok ? t(result.reason) : null;
  return (
    <div
      data-slot="entity-preview"
      data-llm-visible="true"
      className={cn(entityPreviewCardClassName, chrome?.className)}
    >
      {result === null ? (
        <PreviewLoading label={t('loading')} />
      ) : message ? (
        <p className="text-muted-foreground text-xs" data-llm-text={message}>
          {message}
        </p>
      ) : result.ok ? (
        <PreviewBody preview={result.preview} />
      ) : null}
    </div>
  );
}
