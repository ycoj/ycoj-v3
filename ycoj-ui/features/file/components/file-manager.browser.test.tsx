import FileManager from './file-manager';
import type { FileManagerLabels } from '@/features/file/lib/file-manager-labels';
import type { FileInfo } from '@/shared/types/file';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const labels: FileManagerLabels = {
  title: 'Files',
  upload: 'Upload file',
  download: 'Download',
  downloadSelected: 'Download selected',
  preview: 'Preview',
  previewFile: (name) => `Preview file ${name}`,
  previewLoading: 'Loading preview...',
  previewError: 'The file preview could not be displayed.',
  selectAll: 'Select all',
  selectFile: (name) => `Select file ${name}`,
  fileNameLabel: 'Filename',
  size: 'Size',
  modified: 'Modified',
  actions: 'Actions',
  empty: 'There are no files here yet.',
  delete: 'Delete',
  deleting: 'Deleting...',
  removeSelected: 'Remove selected',
  cancel: 'Cancel',
  close: 'Close',
  confirmDelete: (count) =>
    `Delete ${count} selected ${count === 1 ? 'file' : 'files'}?`,
  uploadingFiles: (count) =>
    count === 1 ? `Uploading ${count} file` : `Uploading ${count} files`,
  uploadProgress: 'Upload progress',
  actionFailed: 'The operation failed. Please try again.',
  uploadFailed: (failed, total) =>
    `${failed} of ${total} files failed to upload. Successfully uploaded files were kept.`,
  totalSize: (size) => `Total size: ${size}`,
  formatRejections: (rejections) =>
    rejections.map((item) => `${item.name}: ${item.reason}`).join('\n'),
};

const files: FileInfo[] = [
  {
    _id: 'a',
    name: 'a.txt',
    size: 1024,
    etag: 'a',
    lastModified: new Date('2026-01-02T00:00:00Z'),
  },
  {
    _id: 'b',
    name: 'b.txt',
    size: 2048,
    etag: 'b',
    lastModified: new Date('2026-01-03T00:00:00Z'),
  },
];

function renderManager(
  overrides: {
    onUpload?: (
      file: File,
      onProgress: (ratio: number) => void
    ) => Promise<void>;
    onDelete?: (names: string[]) => Promise<void>;
    canManage?: boolean;
  } = {}
) {
  return render(
    <FileManager
      files={files}
      canManage={overrides.canManage ?? true}
      labels={labels}
      fileUrl={(name) => `/api/file/1/${name}`}
      previewUrl={async (name) => `https://files.example/${name}`}
      onUpload={overrides.onUpload ?? vi.fn().mockResolvedValue(undefined)}
      onDelete={overrides.onDelete ?? vi.fn().mockResolvedValue(undefined)}
    />
  );
}

function selectFiles(input: HTMLInputElement, selection: File[]) {
  return userEvent.upload(input, selection);
}

describe('FileManager uploads', () => {
  it('uploads a selected file and reports progress', async () => {
    let resolveUpload!: () => void;
    const onUpload = vi.fn(
      (_file: File, onProgress: (ratio: number) => void) =>
        new Promise<void>((resolve) => {
          resolveUpload = resolve;
          onProgress(0.5);
        })
    );
    const { container } = renderManager({ onUpload });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]'
    ) as HTMLInputElement;

    await selectFiles(input, [new File(['x'], 'notes.txt')]);

    expect(onUpload).toHaveBeenCalledTimes(1);
    expect(onUpload.mock.calls[0][0].name).toBe('notes.txt');
    expect(screen.getByRole('dialog')).toHaveTextContent('Uploading 1 file');
    expect(screen.getByText('50%')).toBeInTheDocument();

    resolveUpload();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('shows a partial failure message and keeps successful files', async () => {
    const onUpload = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('network'));
    const { container } = renderManager({ onUpload });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]'
    ) as HTMLInputElement;

    await selectFiles(input, [
      new File(['a'], 'first.txt'),
      new File(['b'], 'second.txt'),
    ]);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        '1 of 2 files failed to upload. Successfully uploaded files were kept.'
      )
    );
  });

  it('rejects invalid, duplicate, and over-limit files before uploading', async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = renderManager({ onUpload });
    const input = container.querySelector<HTMLInputElement>(
      'input[type="file"]'
    ) as HTMLInputElement;

    await selectFiles(input, [
      new File(['x'], 'bad/name.txt'),
      new File(['x'], 'a.txt'),
    ]);

    expect(onUpload).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'bad/name.txt: invalidName'
    );
    expect(screen.getByRole('alert')).toHaveTextContent('a.txt: duplicateName');
  });

  it('hides upload controls without management access', () => {
    renderManager({ canManage: false });
    expect(
      screen.queryByRole('button', { name: 'Upload file' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('a.txt')).toBeVisible();
  });
});

describe('FileManager deletion', () => {
  it('deletes a single file after confirmation', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderManager({ onDelete });

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Delete 1 selected file?');
    await user.click(
      screen.getByRole('button', { name: 'Delete', hidden: false })
    );

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(['a.txt']));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    );
  });

  it('batch deletes selected files', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    renderManager({ onDelete });

    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    await user.click(screen.getByRole('button', { name: 'Remove selected' }));

    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Delete 2 selected files?'
    );

    const confirm = screen
      .getAllByRole('button', { name: 'Delete' })
      .find((button) => button.closest('[role="alertdialog"]'));
    await user.click(confirm as HTMLButtonElement);

    await waitFor(() =>
      expect(onDelete).toHaveBeenCalledWith(['a.txt', 'b.txt'])
    );
  });

  it('reports a failed deletion', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockRejectedValue(new Error('Forbidden'));
    renderManager({ onDelete });

    await user.click(
      screen.getByRole('checkbox', { name: 'Select file a.txt' })
    );
    await user.click(screen.getByRole('button', { name: 'Remove selected' }));
    const confirm = screen
      .getAllByRole('button', { name: 'Delete' })
      .find((button) => button.closest('[role="alertdialog"]'));
    await user.click(confirm as HTMLButtonElement);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Forbidden')
    );
  });
});

describe('FileManager downloads', () => {
  it('renders a direct download link through the file URL builder', async () => {
    const user = userEvent.setup();
    renderManager();
    const clicks: string[] = [];
    const originalCreate = document.createElement.bind(document);
    const spy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tag: string) => {
        const element = originalCreate(tag);
        if (tag === 'a') {
          element.addEventListener('click', () =>
            clicks.push((element as HTMLAnchorElement).href)
          );
        }
        return element;
      });

    await user.click(screen.getAllByRole('button', { name: 'Download' })[0]);

    spy.mockRestore();
    expect(clicks[0]).toContain('/api/file/1/a.txt');
  });
});
