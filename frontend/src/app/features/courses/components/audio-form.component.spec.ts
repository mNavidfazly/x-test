import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AudioFormComponent } from './audio-form.component';
import { SupabaseTusUploadService } from '../../../core/services/supabase-tus-upload.service';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockModuleFormData, createMockAudioFormData } from '../../../__mocks__/course.mock';
import { AudioFormData, ModuleFormData, ModuleSavePayload } from '../../../core/models/course.model';

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

describe('AudioFormComponent', () => {
  let mockTusUpload: ReturnType<typeof createMockTusUpload>;

  beforeEach(() => {
    mockTusUpload = createMockTusUpload();
  });

  it('should render title and description fields', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'video' }),
        initialAudioData: createMockAudioFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should initialize form with provided module data', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Existing Audio', description: 'Audio desc' }),
        initialAudioData: createMockAudioFormData({
          file_url: 'course-1/audio.mp3',
          file_name: 'audio.mp3',
          duration_seconds: 180,
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Existing Audio');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Audio desc');
    expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('3');
    expect(screen.getByText('audio.mp3')).toBeTruthy();
  });

  it('should show "Audio File" label', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialAudioData: createMockAudioFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByText('Audio File')).toBeTruthy();
  });

  it('should show "Duration (minutes)" field', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialAudioData: createMockAudioFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByLabelText('Duration (minutes)')).toBeTruthy();
  });

  it('should show "Create Module" button in create mode', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialAudioData: createMockAudioFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" button in edit mode', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialAudioData: createMockAudioFormData(),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '' }),
        initialAudioData: createMockAudioFormData(),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should disable save when no file selected and no existing file', async () => {
    await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialAudioData: createMockAudioFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with audio content type when existing file', async () => {
    const { fixture } = await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'My Audio', description: 'Desc', module_type: 'video', lecture_id: 'l1' }),
        initialAudioData: createMockAudioFormData({
          file_url: 'course-1/audio.mp3',
          file_name: 'audio.mp3',
          file_size: 5242880,
          duration_seconds: null,
          mime_type: 'audio/mpeg',
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
    expect(emittedPayload!.module.title).toBe('My Audio');
    expect(emittedPayload!.module.module_type).toBe('video');
    expect(emittedPayload!.content.type).toBe('audio');
    if (emittedPayload!.content.type === 'audio') {
      expect(emittedPayload!.content.data.file_url).toBe('course-1/audio.mp3');
      expect(emittedPayload!.content.data.file_name).toBe('audio.mp3');
    }
  });

  it('should convert durationMinutes to seconds on save', async () => {
    const { fixture } = await render(AudioFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Duration Test', lecture_id: 'l1' }),
        initialAudioData: createMockAudioFormData({
          file_url: 'course-1/audio.mp3',
          file_name: 'audio.mp3',
          file_size: 1000,
          duration_seconds: 120,
          mime_type: 'audio/mpeg',
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [{ provide: SupabaseTusUploadService, useValue: mockTusUpload }],
    });

    // Duration should have been initialized to 2 minutes (120 seconds / 60)
    const durationInput = screen.getByLabelText('Duration (minutes)') as HTMLInputElement;
    expect(durationInput.value).toBe('2');

    // Change duration to 5.5 minutes
    fireEvent.input(durationInput, { target: { value: '5.5' } });
    fixture.detectChanges();

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise(r => setTimeout(r));

    expect(emittedPayload).not.toBeNull();
    if (emittedPayload!.content.type === 'audio') {
      expect(emittedPayload!.content.data.duration_seconds).toBe(330);
    }
  });
});
