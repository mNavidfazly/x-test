import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { ModuleFilesListComponent } from './module-files-list.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockModuleFile } from '../../../__mocks__/course.mock';

describe('ModuleFilesListComponent', () => {
  it('should render list of files', async () => {
    const files = [
      createMockModuleFile({ id: 'f1', file_name: 'slides.pdf', file_size: 2097152 }),
      createMockModuleFile({ id: 'f2', file_name: 'code.zip', file_size: 512000 }),
    ];
    await render(ModuleFilesListComponent, {
      componentInputs: { files },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.getByText('slides.pdf')).toBeTruthy();
    expect(screen.getByText('code.zip')).toBeTruthy();
    expect(screen.getByText('2.0 MB')).toBeTruthy();
    expect(screen.getByText('500.0 KB')).toBeTruthy();
  });

  it('should render nothing when files array is empty', async () => {
    const { container } = await render(ModuleFilesListComponent, {
      componentInputs: { files: [] },
      componentImports: [MockLucideIconComponent],
    });

    expect(container.querySelector('ul')).toBeNull();
  });

  it('should have download links', async () => {
    const files = [createMockModuleFile({ file_url: 'https://example.com/file.pdf' })];
    await render(ModuleFilesListComponent, {
      componentInputs: { files },
      componentImports: [MockLucideIconComponent],
    });

    const link = document.querySelector('a[download]') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('file.pdf');
  });
});
