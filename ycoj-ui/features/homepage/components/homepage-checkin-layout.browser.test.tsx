import '@/app/globals.css';
import {
  getColumnSpans,
  normalizeHomepageColumns,
  placeCheckinColumn,
  type ResolvedSection,
} from '../section-layout';
import Contests from './contests';
import DailyCheckin from './daily-checkin';
import HomepageColumns from './homepage-columns';
import messages from '@/messages/en';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import type { HomepageCheckin } from '@/shared/types/checkin';
import type { Contest } from '@/shared/types/contest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';

const checkin: HomepageCheckin = {
  timezone: 'UTC+08:00',
  date: '2026-11-07',
  canCheckin: true,
  record: null,
  streak: 0,
};

const contest: Contest = {
  _id: 'c'.repeat(24),
  docId: 'c'.repeat(24),
  docType: 30,
  domainId: 'system',
  owner: 1,
  beginAt: new Date('2026-12-01T00:00:00Z'),
  endAt: new Date('2026-12-01T05:00:00Z'),
  attend: 32,
  title: 'Winter round',
  content: '',
  rule: 'oi',
  pids: [],
  duration: 5,
};

function renderSection(section: ResolvedSection, index: number): ReactNode {
  if (section.name === 'checkin') {
    return (
      <DailyCheckin
        key={`${section.name}-${index}`}
        checkin={checkin}
        username="alice"
      />
    );
  }
  if (section.name === 'contest') {
    return <Contests key={`${section.name}-${index}`} contests={[contest]} />;
  }
  if (section.name === 'hitokoto') {
    return (
      <Card key={`${section.name}-${index}`}>
        <CardHeader>
          <CardTitle>Quote of the moment</CardTitle>
        </CardHeader>
        <CardContent>Still water runs deep.</CardContent>
      </Card>
    );
  }
  return null;
}

describe('configured homepage check-in', () => {
  it('places the check-in card in the configured wide column', async () => {
    const placed = placeCheckinColumn(
      normalizeHomepageColumns([
        {
          width: 8,
          sections: [
            ['checkin', true],
            ['contest', [[contest], {}]],
          ],
        },
        { width: 4, sections: [['hitokoto', true]] },
      ]).columns
    );
    const spans = getColumnSpans(placed);

    await page.viewport(1280, 640);
    render(
      <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
        <main className="mx-auto w-[1100px] p-6">
          <HomepageColumns
            spans={spans}
            columns={placed.map((column) =>
              column.sections.map((section, index) =>
                renderSection(section, index)
              )
            )}
          />
        </main>
      </NextIntlClientProvider>
    );

    const checkinCard = screen.getByRole('region', { name: 'Daily check-in' });
    const contestLink = screen.getByRole('link', { name: 'Winter round' });
    const quote = screen.getByText('Quote of the moment');
    const checkinBox = checkinCard.getBoundingClientRect();
    const contestBox = contestLink.getBoundingClientRect();
    const quoteBox = quote.getBoundingClientRect();

    expect(spans).toEqual([8, 4]);
    expect(screen.getByRole('button', { name: 'Check in' })).toBeVisible();
    expect(checkinBox.bottom).toBeLessThanOrEqual(contestBox.top);
    expect(checkinBox.right).toBeLessThanOrEqual(quoteBox.left);

    await page.screenshot({
      path: '../../../test-results/homepage-checkin-config.png',
    });
  });
});
