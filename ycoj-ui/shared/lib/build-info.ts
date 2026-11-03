/** Commit and commit date of the running client bundle, inlined at build time. */
export type BuildInfo = {
  commit: string;
  date: string;
};

export const buildInfo: BuildInfo = {
  commit: process.env.BUILD_COMMIT ?? '',
  date: process.env.BUILD_DATE ?? '',
};
