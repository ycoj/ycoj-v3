import { alova } from '@/api/server';
import type { Blog } from '@/shared/types/blog';
import type { HomepageCheckin } from '@/shared/types/checkin';
import type {
  Contest as ContestDoc,
  ContestStatusDict,
} from '@/shared/types/contest';
import type {
  Discussion as DiscussionDoc,
  Node,
} from '@/shared/types/discussion';
import type { DomainDoc } from '@/shared/types/domain';
import type { Homework } from '@/shared/types/homework';
import type { ListProjectionProblem } from '@/shared/types/problem';
import type { TrainingDoc, TrainingStatusDict } from '@/shared/types/training';
import type { BaseUser } from '@/shared/types/user';

export type BannerConfig = {
  max_width?: string;
  pictures: {
    /** 图片 URL */
    src: string;
    /** 点击图片跳转的链接 */
    link: string;
  }[];
};
export type Banner = ['banner', BannerConfig];

export type Bulletin = ['bulletin', boolean];
export type Contest = ['contest', [ContestDoc[], ContestStatusDict]];
export type HomeworkSection = ['homework', [Homework[], ContestStatusDict]];
export type Training = ['training', [TrainingDoc[], TrainingStatusDict]];
export type Ranking = ['ranking', number[]];
export type Hitokoto = ['hitokoto', boolean];
export type Discussion = ['discussion', [DiscussionDoc[], Node[]]];
export type StarredProblems = ['starred_problems', [ListProjectionProblem[]]];
export type RecentProblems = [
  'recent_problems',
  [ListProjectionProblem[], Record<string, unknown>],
];
export type RecentBlogs = ['recent_blogs', Blog[]];
export type DiscussionNodes = ['discussion_nodes', Node[]];
export type ErrorSection = ['error', string];

export type SuggestionSite = {
  link: string;
  title: string;
};
export type SuggestionSection = {
  title: string;
  sites: SuggestionSite[];
};
export type Suggestions = ['suggestions', SuggestionSection[]];

export type CountdownEvent = {
  name: string;
  date: string;
  /** 事件持续天数 */
  duration: number;
};
export type CountdownConfig = {
  events: CountdownEvent[];
  startDate: string;
};
export type Countdown = ['countdown', CountdownConfig];

export type SectionType =
  | Banner
  | Bulletin
  | Contest
  | HomeworkSection
  | Training
  | Ranking
  | Hitokoto
  | Discussion
  | StarredProblems
  | RecentProblems
  | RecentBlogs
  | DiscussionNodes
  | Suggestions
  | Countdown
  | ErrorSection;

/**
 * One entry of the server-configured homepage. The first item is the section
 * name from the `hydrooj.homepage` YAML; the second is the section payload.
 * Deployment add-ons may return names outside `SectionType`, so consumers must
 * tolerate unknown names and skip them.
 */
export type SectionEntry = [name: string, payload: unknown];

export type Content = {
  /** Column width in twelfths of the homepage grid, as in the legacy layout. */
  width: number;
  sections: SectionEntry[];
};

export type HomepageUser = BaseUser & {
  /** Domain rating points, exposed through the public user fields. */
  rp?: number;
  bio?: string | null;
};

export type HomepageUserDict = Record<number, HomepageUser>;

export type HomepageResponse = {
  checkin: HomepageCheckin;
  bulletin: string;
  contents: Content[];
  udict: HomepageUserDict;
  domain: DomainDoc;
};

export const getHomepage = () => alova.Get<HomepageResponse>('/');
