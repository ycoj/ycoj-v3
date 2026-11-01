import TrainingSection from './training';
import messages from '@/messages/en';
import type { TrainingDoc, TrainingStatusDict } from '@/shared/types/training';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

function makeTraining(overrides: Partial<TrainingDoc> = {}): TrainingDoc {
  return {
    docId: 't'.repeat(24),
    docType: 40,
    domainId: 'system',
    title: 'Dynamic programming',
    content: 'Learn DP step by step.',
    description: '',
    owner: 1,
    dag: [
      { _id: 1, title: 'Basics', requireNids: [], pids: [1000, 1001] },
      { _id: 2, title: 'Advanced', requireNids: [1], pids: [1002] },
    ],
    attend: 7,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function renderSection(
  trainings: TrainingDoc[],
  statusDict: TrainingStatusDict = {},
  canEnroll = true
) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <TrainingSection
        trainings={trainings}
        statusDict={statusDict}
        canEnroll={canEnroll}
      />
    </NextIntlClientProvider>
  );
}

describe('homepage training section', () => {
  it('links to the training and summarizes its contents', () => {
    renderSection([makeTraining()]);

    expect(
      screen.getByRole('link', { name: 'Dynamic programming' })
    ).toHaveAttribute('href', `/training/${'t'.repeat(24)}`);
    expect(screen.getByText('2 sections')).toBeVisible();
    expect(screen.getByText('3 problems')).toBeVisible();
  });

  it('shows completion progress only after enrolling', () => {
    renderSection([makeTraining()], {
      ['t'.repeat(24)]: {
        docId: 't'.repeat(24),
        uid: 2,
        enroll: 1,
        doneNids: [],
        donePids: [1000, 1001],
        done: false,
      },
    });

    expect(screen.getByText('Joined')).toBeVisible();
    expect(screen.getByText('67%')).toBeVisible();
  });

  it('prompts a signed-in visitor to join when not enrolled', () => {
    renderSection([makeTraining()], {}, true);
    expect(screen.getByText('Not enrolled')).toBeVisible();
  });

  it('hides itself when no training is available', () => {
    const { container } = renderSection([]);
    expect(container).toBeEmptyDOMElement();
  });
});
