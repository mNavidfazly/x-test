import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DownloadFormComponent } from './download-form.component';
import { SupabaseTusUploadService } from '../../../core/services/supabase-tus-upload.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockModuleFormData, createMockDownloadFormData } from '../../../__mocks__/course.mock';
import { DownloadFormData, ModuleFormData, ModuleSavePayload } from '../../../core/models/course.model';

const defaultImports = [FormsModule, FileUploadComponent, MockLucideIconComponent];

function createMockTusUpload() {
  return {
    uploading: signal(false),
    progress: signal(0),
    error: signal<string | null>(null),
    uploadedPath: signal<string | null>(null),
    upload: vi.fn().mockResolvedValue('uploaded-path'),
    abort: vi.fn(),
    reset: vi.fn(),
  };
}

describe('DownloadFormComponent', () => {
  let mockTusUpload: ReturnType<typeof createMockTusUpload>;

  beforeEach(() => {
    mockTusUpload = createMockTusUpload();
  });

  it('should render title and description fields', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialDownloadData: createMockDownloadFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should initialize form with provided data', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Existing Download', description: 'Download desc' }),
        initialDownloadData: createMockDownloadFormData({
          file_url: 'course-1/resources.zip',
          file_name: 'resources.zip',
          file_size: 52428800,
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Existing Download');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Download desc');
    expect(screen.getByText('resources.zip')).toBeTruthy();
  });

  it('should show "ZIP File" label', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialDownloadData: createMockDownloadFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByText('ZIP File')).toBeTruthy();
  });

  it('should show "Create Module" button in create mode', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialDownloadData: createMockDownloadFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" in edit mode', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialDownloadData: createMockDownloadFormData(),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '' }),
        initialDownloadData: createMockDownloadFormData(),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should disable save when no file and no existing file', async () => {
    await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialDownloadData: createMockDownloadFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with download content type when existing file', async () => {
    const { fixture } = await render(DownloadFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'My Download', description: 'Desc', module_type: 'video', lecture_id: 'l1' }),
        initialDownloadData: createMockDownloadFormData({
          file_url: 'course-1/resources.zip',
          file_name: 'resources.zip',
          file_size: 52428800,
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise(r => setTimeout(r));

    expect(emittedPayload).not.toBeNull();
    expect(emittedPayload!.module.title).toBe('My Download');
    expect(emittedPayload!.module.module_type).toBe('video');
    expect(emittedPayload!.content.type).toBe('download');
    if (emittedPayload!.content.type === 'download') {
      expect(emittedPayload!.content.data.file_url).toBe('course-1/resources.zip');
      expect(emittedPayload!.content.data.file_name).toBe('resources.zip');
      expect(emittedPayload!.content.data.file_size).toBe(52428800);
    }
  });
});
