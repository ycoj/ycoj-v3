type ProblemOwner = {
  owner: number;
  maintainer?: number[];
};

/**
 * Owner-or-maintainer check matching the backend's `user.own(doc)`.
 */
export function isOwner(
  problem: ProblemOwner,
  userId: number | null | undefined
): boolean {
  if (userId === null || userId === undefined) return false;
  return (
    problem.owner === userId || (problem.maintainer ?? []).includes(userId)
  );
}
