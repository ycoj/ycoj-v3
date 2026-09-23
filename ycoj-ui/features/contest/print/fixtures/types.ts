import type { ContestManagementResponse } from '@/api/server/method/contests/management';
import type { PrintableContest } from '@/features/contest/print/model';

/**
 * A print-pipeline test fixture: one management API payload plus the document
 * the draft builder is expected to derive from it at `document.language`.
 * Fixtures are exercised both by the schema test and by later builder tests.
 */
export type PrintFixture = {
  /** Short identifier used in test output. */
  name: string;
  /** Management payload the draft builder consumes. */
  response: ContestManagementResponse;
  /** Expected default document for `response`. */
  document: PrintableContest;
};
