export const RATING_POPULATIONS = [
  'open',
  'primary',
  'junior',
  'senior',
] as const;
export type RatingPopulation = (typeof RATING_POPULATIONS)[number];
export type RatingChange = {
  uid: number;
  rank: number;
  before: number;
  after: number;
  delta: number;
  provisional: boolean;
};
export type ContestRating = {
  status: 'pending' | 'settled' | 'skipped';
  changes: RatingChange[];
};
export type UserContestRating = {
  rating: number;
  peak: number;
  contests: number;
  provisional: boolean;
  history: (RatingChange & { tid: string; title: string; endAt: string })[];
};
