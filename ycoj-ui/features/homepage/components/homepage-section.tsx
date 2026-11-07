import { isCheckinSectionShown, type ResolvedSection } from '../section-layout';
import Banner from './banner';
import RecentBlogs from './blogs';
import Bulletin from './bulletin';
import Contests from './contests';
import Countdown from './countdown';
import DailyCheckin from './daily-checkin';
import DiscussionNodes from './discussion-nodes';
import Discussions from './discussions';
import Hitokoto from './hitokoto';
import HomeworkSection from './homework';
import RankingSection from './ranking';
import RecentProblems from './recent-problems';
import SectionError from './section-error';
import StarredProblems from './starred-problems';
import Suggestions from './suggestions';
import TrainingSection from './training';
import type {
  BannerConfig,
  CountdownConfig,
  HomeworkSection as HomeworkSectionPayload,
  SectionType,
  Suggestions as SuggestionsPayload,
} from '@/api/server/method/ui/homepage';
import type { Blog } from '@/shared/types/blog';
import type { HomepageCheckin } from '@/shared/types/checkin';
import type {
  Discussion as DiscussionDoc,
  Node,
} from '@/shared/types/discussion';
import type { ListProjectionProblem } from '@/shared/types/problem';
import type { TrainingDoc, TrainingStatusDict } from '@/shared/types/training';
import type { BaseUserDict } from '@/shared/types/user';

type Props = {
  section: ResolvedSection;
  udict: BaseUserDict;
  bulletin?: string;
  checkin: HomepageCheckin;
  username: string;
  canEnroll: boolean;
};

/**
 * Renders one server section by name. Payloads come from a YAML-driven backend
 * and are not schema-checked there, so each branch checks the shape it needs
 * and returns `null` for anything unusable instead of throwing.
 *
 * Unknown names never reach this component: `normalizeHomepageColumns` drops
 * them, because a deployment add-on's custom widget has no renderer here.
 */
export default function HomepageSection({
  section,
  udict,
  bulletin,
  checkin,
  username,
  canEnroll,
}: Props) {
  switch (section.name) {
    case 'banner': {
      const payload = section.payload as BannerConfig;
      if (!Array.isArray(payload?.pictures) || !payload.pictures.length) {
        return null;
      }
      return (
        <div className="hidden md:block">
          <Banner banner={payload} />
        </div>
      );
    }
    case 'bulletin':
      return <Bulletin bulletin={bulletin} />;
    case 'contest': {
      const payload = section.payload as Extract<
        SectionType,
        ['contest', unknown]
      >[1];
      if (!Array.isArray(payload?.[0]) || !payload[0].length) return null;
      return <Contests contests={payload[0]} />;
    }
    case 'homework': {
      const payload = section.payload as HomeworkSectionPayload[1];
      if (!Array.isArray(payload?.[0]) || !payload[0].length) return null;
      return <HomeworkSection homeworks={payload[0]} statusDict={payload[1]} />;
    }
    case 'training': {
      const payload = section.payload as Extract<
        SectionType,
        ['training', unknown]
      >[1];
      if (!Array.isArray(payload?.[0]) || !payload[0].length) return null;
      return (
        <TrainingSection
          trainings={payload[0] as TrainingDoc[]}
          statusDict={payload[1] as TrainingStatusDict | undefined}
          canEnroll={canEnroll}
        />
      );
    }
    case 'ranking': {
      const payload = section.payload as Extract<
        SectionType,
        ['ranking', unknown]
      >[1];
      if (!Array.isArray(payload) || !payload.length) return null;
      return <RankingSection uids={payload} udict={udict} />;
    }
    case 'hitokoto':
      return <Hitokoto />;
    case 'discussion': {
      const payload = section.payload as Extract<
        SectionType,
        ['discussion', unknown]
      >[1];
      if (!Array.isArray(payload?.[0]) || !payload[0].length) return null;
      return (
        <Discussions
          discussions={payload[0] as DiscussionDoc[]}
          udict={udict}
        />
      );
    }
    case 'starred_problems': {
      const payload = section.payload as Extract<
        SectionType,
        ['starred_problems', unknown]
      >[1];
      if (!Array.isArray(payload?.[0]) || !payload[0].length) return null;
      return (
        <StarredProblems problems={payload[0] as ListProjectionProblem[]} />
      );
    }
    case 'recent_problems': {
      const payload = section.payload as Extract<
        SectionType,
        ['recent_problems', unknown]
      >[1];
      if (!Array.isArray(payload?.[0]) || !payload[0].length) return null;
      return (
        <RecentProblems
          problems={payload[0] as ListProjectionProblem[]}
          psdict={payload[1] as Record<string, never>}
        />
      );
    }
    case 'recent_blogs': {
      const payload = section.payload as Extract<
        SectionType,
        ['recent_blogs', unknown]
      >[1];
      if (!Array.isArray(payload) || !payload.length) return null;
      return <RecentBlogs blogs={payload as Blog[]} udict={udict} />;
    }
    case 'discussion_nodes': {
      const payload = section.payload as Extract<
        SectionType,
        ['discussion_nodes', unknown]
      >[1];
      if (!Array.isArray(payload) || !payload.length) return null;
      return <DiscussionNodes nodes={payload as Node[]} />;
    }
    case 'suggestion':
    case 'suggestions': {
      // The backend has no getter for this section, so a bare `true` means the
      // legacy built-in link list; an add-on may instead return real sections.
      if (section.payload === true) return <Suggestions useDefaults />;
      const payload = section.payload as SuggestionsPayload[1];
      if (!Array.isArray(payload) || !payload.length) return null;
      return <Suggestions sections={payload} />;
    }
    case 'countdown': {
      const payload = section.payload as CountdownConfig;
      if (!Array.isArray(payload?.events) || !payload.events.length) {
        return null;
      }
      return <Countdown config={payload} />;
    }
    case 'checkin':
      if (!isCheckinSectionShown(section.payload)) return null;
      return <DailyCheckin checkin={checkin} username={username} />;
    case 'error':
      return <SectionError message={String(section.payload ?? '')} />;
    default: {
      const unsupported: never = section.name;
      return unsupported;
    }
  }
}
