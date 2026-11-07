export type EntityKind =
  'problem' | 'contest' | 'homework' | 'training' | 'user';

/**
 * Surface of a preview card. Equipped cosmetics style the avatar and name
 * inside the card. A later card cosmetic can supply `className` to replace
 * the background, border, and shadow without changing the content.
 */
export type EntityPreviewChrome = {
  className?: string;
};

export type ScheduleStatus = 'pending' | 'running' | 'ended';

export type ProblemPreview = {
  kind: 'problem';
  id: string;
  pid: string;
  title: string;
  difficulty: number;
  tags: string[];
  nAccept: number;
  nSubmit: number;
  hidden: boolean;
};

export type ContestPreview = {
  kind: 'contest';
  id: string;
  title: string;
  rule: string;
  status: ScheduleStatus;
  beginAt: string;
  endAt: string;
  attend: number;
  problemCount: number;
  rated: boolean;
};

export type HomeworkPreview = {
  kind: 'homework';
  id: string;
  title: string;
  status: ScheduleStatus;
  deadline: string;
  attend: number;
  problemCount: number;
};

export type TrainingPreview = {
  kind: 'training';
  id: string;
  title: string;
  excerpt: string;
  sectionCount: number;
  problemCount: number;
  attend: number;
  enrolled: boolean;
  progress: number | null;
};

export type UserPreviewEquipment = {
  frame?: string;
  background?: string;
  title?: string;
  accent?: string;
};

export type UserPreview = {
  kind: 'user';
  id: string;
  uname: string;
  displayName: string | null;
  avatar: string;
  role: string | null;
  badge: string | null;
  bio: string;
  nAccept: number;
  rating: number | null;
  rank: number | null;
  ccfLevel: number;
  priv: number;
  equipment: UserPreviewEquipment;
};

export type EntityPreview =
  | ProblemPreview
  | ContestPreview
  | HomeworkPreview
  | TrainingPreview
  | UserPreview;

export type EntityPreviewFailure = 'denied' | 'missing' | 'failed';

export type EntityPreviewResult =
  | { ok: true; preview: EntityPreview }
  | { ok: false; reason: EntityPreviewFailure };

export type EntityReference = {
  kind: EntityKind;
  id: string;
};
