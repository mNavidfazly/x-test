import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { DownloadViewerComponent } from './download-viewer.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { ModuleDownload } from '../../../core/models/course.model';

function createMockDownload(overrides: Partial<ModuleDownload> = {}): ModuleDownload {
  return {
    file_url: 'https://example.com/files/dataset.zip',
    file_name: 'dataset.zip',
    file_size: 10485760,
    ...overrides,
  };
}

describe('DownloadViewerComponent', () => {
  it('should display file name', async () => {
    const download = createMockDownload({ file_name: 'project-files.zip' });
    await render(DownloadViewerComponent, {
      componentInputs: { download },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.getByText('project-files.zip')).toBeTruthy();
  });

  it('should display file size', async () => {
    const download = createMockDownload({ file_size: 10485760 });
    await render(DownloadViewerComponent, {
      componentInputs: { download },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.getByText('10.0 MB')).toBeTruthy();
  });

  it('should display description when provided', async () => {
    const download = createMockDownload();
    await render(DownloadViewerComponent, {
      componentInputs: { download, description: 'Supplementary course materials' },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.getByText('Supplementary course materials')).toBeTruthy();
  });

  it('should hide description when null', async () => {
    const download = createMockDownload();
    await render(DownloadViewerComponent, {
      componentInputs: { download, description: null },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.queryByText('Supplementary course materials')).toBeNull();
  });

  it('should render download link with correct href', async () => {
    const download = createMockDownload({ file_url: 'https://cdn.example.com/report.pdf' });
    await render(DownloadViewerComponent, {
      componentInputs: { download },
      componentImports: [MockLucideIconComponent],
    });

    const link = screen.getByRole('link', { name: /Download File/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('https://cdn.example.com/report.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('should show "Download File" text', async () => {
    const download = createMockDownload();
    await render(DownloadViewerComponent, {
      componentInputs: { download },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.getByText('Download File')).toBeTruthy();
  });
});
