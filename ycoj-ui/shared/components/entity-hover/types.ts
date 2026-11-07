export type EntityKind = 'problem' | 'contest' | 'homework' | 'training';

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

export type EntityPreview =
  ProblemPreview | ContestPreview | HomeworkPreview | TrainingPreview;

export type EntityPreviewFailure = 'denied' | 'missing' | 'failed';

export type EntityPreviewResult =
  | { ok: true; preview: EntityPreview }
  | { ok: false; reason: EntityPreviewFailure };

export type EntityReference = {
  kind: EntityKind;
  id: string;
};
