import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { FormsModule } from '@angular/forms';
import { ModuleFilesEditorComponent } from './module-files-editor.component';
import { CourseService } from '../../../core/services/course.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockCourseService } from '../../../__mocks__/course.mock';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';

// file_url now stores the storage path (not a public URL) — signed URLs are generated at view time
const mockFiles = [
  { id: 'f1', file_url: 'course-1/123-notes.pdf', file_name: 'notes.pdf', file_size: 102400 },
  { id: 'f2', file_url: 'course-1/456-data.csv', file_name: 'data.csv', file_size: null },
];

function setupMocks(options?: { files?: typeof mockFiles; loadError?: boolean }) {
  const courseService = createMockCourseService();
  const supabase = createMockSupabaseService();

  if (options?.loadError) {
    courseService.loadModuleFiles.mockRejectedValue(new Error('Load failed'));
  } else {
    courseService.loadModuleFiles.mockResolvedValue(options?.files ?? mockFiles);
  }

  return { courseService, supabase };
}

async function renderComponent(courseService: ReturnType<typeof createMockCourseService>, supabase: ReturnType<typeof createMockSupabaseService>) {
  const result = await render(ModuleFilesEditorComponent, {
    componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule],
    componentInputs: { moduleId: 'mod-1', courseId: 'course-1' },
    providers: [
      { provide: CourseService, useValue: courseService },
      { provide: SupabaseService, useValue: supabase },
    ],
  });

  // Flush async ngOnInit
  await new Promise(r => setTimeout(r));
  result.fixture.detectChanges();

  return result;
}

describe('ModuleFilesEditorComponent', () => {
  it('should render "Attached Files" heading', async () => {
    const { courseService, supabase } = setupMocks();
    await renderComponent(courseService, supabase);

    expect(screen.getByText('Attached Files')).toBeTruthy();
  });

  it('should call loadModuleFiles on init and display files', async () => {
    const { courseService, supabase } = setupMocks();
    await renderComponent(courseService, supabase);

    expect(courseService.loadModuleFiles).toHaveBeenCalledWith('mod-1');
    expect(screen.getByText('notes.pdf')).toBeTruthy();
    expect(screen.getByText('data.csv')).toBeTruthy();
  });

  it('should show file size formatted', async () => {
    const { courseService, supabase } = setupMocks();
    await renderComponent(courseService, supabase);

    // 102400 bytes = 100.0 KB
    expect(screen.getByText('100.0 KB')).toBeTruthy();
  });

  it('should show loading state initially', async () => {
    const courseService = createMockCourseService();
    const supabase = createMockSupabaseService();

    // Make loadModuleFiles hang indefinitely
    courseService.loadModuleFiles.mockReturnValue(new Promise(() => {}));

    await render(ModuleFilesEditorComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule],
      componentInputs: { moduleId: 'mod-1', courseId: 'course-1' },
      providers: [
        { provide: CourseService, useValue: courseService },
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    expect(screen.getByText('Loading files...')).toBeTruthy();
  });

  // Upload stores the storage path (data.path) in module_files.file_url,
  // NOT a public URL. The private bucket stays secure; signed URLs are generated at read time.
  it('should upload file and store storage path (not public URL)', async () => {
    const { courseService, supabase } = setupMocks();
    await renderComponent(courseService, supabase);

    const testFile = new File(['hello'], 'upload.txt', { type: 'text/plain' });

    // Get the hidden file input and simulate change
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    // Simulate file selection
    Object.defineProperty(fileInput, 'files', { value: [testFile], configurable: true });
    fireEvent.change(fileInput);

    // Flush upload
    await new Promise(r => setTimeout(r));

    expect(supabase.client.storage.from).toHaveBeenCalledWith('course-files');

    const storageBucket = supabase.client.storage.from('course-files');
    expect(storageBucket.upload).toHaveBeenCalled();

    // Verify: stored value is the path from data.path, NOT a public URL
    expect(courseService.addModuleFile).toHaveBeenCalledWith('mod-1', {
      file_url: 'test/file.pdf', // matches mock upload response data.path
      file_name: 'upload.txt',
      file_size: 5,
    });

    // loadModuleFiles called once on init + once after upload
    expect(courseService.loadModuleFiles).toHaveBeenCalledTimes(2);
  });

  it('should show upload error on failure', async () => {
    const { courseService, supabase } = setupMocks();

    // Make storage upload fail
    const storageBucket = supabase.client.storage.from('course-files');
    (storageBucket as Record<string, unknown>).upload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage quota exceeded' },
    });

    const { fixture } = await renderComponent(courseService, supabase);

    const testFile = new File(['hello'], 'upload.txt', { type: 'text/plain' });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [testFile], configurable: true });
    fireEvent.change(fileInput);

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Storage quota exceeded')).toBeTruthy();
  });

  // Delete uses file_url directly as storage path (no URL parsing needed).
  // Old code extracted path from public URL; now file_url IS the path.
  it('should delete file from storage using stored path', async () => {
    const { courseService, supabase } = setupMocks();
    await renderComponent(courseService, supabase);

    const deleteButtons = screen.getAllByLabelText('Delete file');
    expect(deleteButtons.length).toBe(2);

    fireEvent.click(deleteButtons[0]);

    await new Promise(r => setTimeout(r));

    const storageBucket = supabase.client.storage.from('course-files');
    // file_url IS the storage path — passed directly to remove()
    expect(storageBucket.remove).toHaveBeenCalledWith(['course-1/123-notes.pdf']);
    expect(courseService.deleteModuleFile).toHaveBeenCalledWith('f1');
  });

  it('should refresh file list after delete', async () => {
    const { courseService, supabase } = setupMocks();
    await renderComponent(courseService, supabase);

    const deleteButtons = screen.getAllByLabelText('Delete file');
    fireEvent.click(deleteButtons[0]);

    await new Promise(r => setTimeout(r));

    // loadModuleFiles: 1 on init + 1 after delete
    expect(courseService.loadModuleFiles).toHaveBeenCalledTimes(2);
  });
});
