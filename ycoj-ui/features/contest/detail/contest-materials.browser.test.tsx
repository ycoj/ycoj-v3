import ContestMaterials from './contest-materials';
import messages from '@/messages/en';
import type { FileInfo } from '@/shared/types/file';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';

function makeFile(name: string, size: number): FileInfo {
  return {
    _id: name,
    name,
    size,
    etag: 'etag',
    lastModified: new Date('2026-01-01T00:00:00Z'),
  };
}

function renderMaterials(files: FileInfo[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContestMaterials tid="t1d2" files={files} />
    </NextIntlClientProvider>
  );
}

describe('ContestMaterials', () => {
  it('offers a download link for every material', () => {
    renderMaterials([
      makeFile('选手手册.pdf', 2048),
      makeFile('环境说明.txt', 64),
    ]);

    expect(
      screen.getByRole('link', { name: 'Download 选手手册.pdf' })
    ).toHaveAttribute(
      'href',
      '/api/contest/t1d2/file/private/%E9%80%89%E6%89%8B%E6%89%8B%E5%86%8C.pdf'
    );
    expect(
      screen.getByRole('link', { name: 'Download 环境说明.txt' })
    ).toBeVisible();
  });

  it('shows how large each material is', () => {
    renderMaterials([makeFile('选手手册.pdf', 2048)]);

    expect(screen.getByText('2.0 KiB')).toBeVisible();
  });

  it('shows nothing when the viewer has no materials', () => {
    renderMaterials([]);

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
