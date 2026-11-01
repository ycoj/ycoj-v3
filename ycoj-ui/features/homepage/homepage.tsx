import DailyCheckin from './components/daily-checkin';
import HomepageColumns from './components/homepage-columns';
import HomepageSection from './components/homepage-section';
import {
  getColumnSpans,
  normalizeHomepageColumns,
  placeCheckinColumn,
  type HomepageColumn,
} from './section-layout';
import ServerApis from '@/api/server/method';
import type { HomepageResponse } from '@/api/server/method/ui/homepage';
import { getUser } from '@/features/user/lib/get-user';
import { hasPriv, PRIV } from '@/features/user/lib/priv';
import type { BaseUserDict } from '@/shared/types/user';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

type ColumnInput = {
  columns: HomepageColumn[];
  udict: BaseUserDict;
  bulletin?: string;
  checkin: HomepageResponse['checkin'];
  username: string;
  canEnroll: boolean;
};

/**
 * Builds the homepage columns from the normalized server layout.
 *
 * Layout decision (HOME-02): the server's column widths and section order are
 * preserved. Every configured column renders in order on a 12-column grid with
 * its configured width; the daily check-in (a YCOJ addition, not a legacy
 * section) is placed first in the last narrow column so it stays in the
 * sidebar, or first in the last column when every column is wide. Configured
 * widths are only scaled when a custom layout totals more than twelve units.
 *
 * Sections render in server order regardless of their kind: the column comes
 * from the configuration rather than from the section name.
 */
export function buildHomepageColumns({
  columns,
  udict,
  bulletin,
  checkin,
  username,
  canEnroll,
}: ColumnInput) {
  const placed = placeCheckinColumn(columns);
  const spans = getColumnSpans(placed.columns);

  const rendered = placed.columns.map((column, index): ReactNode[] | null => {
    const nodes: ReactNode[] = column.sections.map((section, sectionIndex) => (
      <HomepageSection
        // A config may repeat a name; the position keeps keys unique.
        key={`${section.name}-${sectionIndex}`}
        section={section}
        udict={udict}
        bulletin={bulletin}
        canEnroll={canEnroll}
      />
    ));
    if (index === placed.checkinColumnIndex) {
      nodes.push(
        <DailyCheckin key="checkin" checkin={checkin} username={username} />
      );
    }
    // A configured column with no known sections is dropped so the remaining
    // columns get the full width; an added check-in column always has content.
    return nodes.length ? nodes : null;
  });

  const visibleColumns = rendered.filter(
    (nodes): nodes is ReactNode[] => nodes !== null
  );
  const visibleSpans = spans.filter((_, index) => rendered[index] !== null);

  return <HomepageColumns spans={visibleSpans} columns={visibleColumns} />;
}

export default async function Homepage() {
  const [homepage, user] = await Promise.all([
    ServerApis.UI.getHomepage(),
    getUser(),
  ]);
  if (!user?._id) redirect('/login');

  const { columns } = normalizeHomepageColumns(homepage.contents);

  return buildHomepageColumns({
    columns,
    udict: homepage.udict,
    bulletin: homepage.domain.bulletin,
    checkin: homepage.checkin,
    username: user.uname,
    canEnroll: hasPriv(user, PRIV.PRIV_USER_PROFILE),
  });
}
