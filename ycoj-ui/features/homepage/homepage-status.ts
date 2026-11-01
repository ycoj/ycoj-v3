import dayjs from 'dayjs';

export type RuntimeStatus = 'pending' | 'running' | 'ended';

/** Shared time-window status used by the contest and homework cards. */
export function getRuntimeStatus(
  beginAt: Date | string,
  endAt: Date | string,
  now: dayjs.Dayjs = dayjs()
): RuntimeStatus {
  const begin = dayjs(beginAt);
  const end = dayjs(endAt);
  if (!begin.isValid() || !end.isValid()) return 'ended';
  if (now.isBefore(begin)) return 'pending';
  if (now.isBefore(end)) return 'running';
  return 'ended';
}

export function getTrainingProblemCount(dag: { pids: number[] }[]): number {
  return dag.reduce((sum, node) => sum + node.pids.length, 0);
}

/** Rounded completion percentage, clamped to 0-100 and safe for an empty DAG. */
export function getTrainingCompletion(
  donePids: number[] | undefined,
  totalProblems: number
): number {
  if (totalProblems <= 0) return 0;
  const done = donePids?.length ?? 0;
  return Math.min(100, Math.max(0, Math.round((done / totalProblems) * 100)));
}

/** Group discussion nodes by their category, preserving server order. */
export function groupDiscussionNodes<T extends { content: string }>(
  nodes: T[]
): { category: string; nodes: T[] }[] {
  const groups: { category: string; nodes: T[] }[] = [];
  for (const node of nodes) {
    const category = node.content?.trim() || '';
    const existing = groups.find((group) => group.category === category);
    if (existing) existing.nodes.push(node);
    else groups.push({ category, nodes: [node] });
  }
  return groups;
}
