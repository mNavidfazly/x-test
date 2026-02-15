import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { signal } from '@angular/core';
import { VideoFormComponent } from './video-form.component';
import { createMockModuleFormData, createMockVideoFormData } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { ModuleSavePayload } from '../../../core/models/course.model';
import { BunnyUploadService } from '../../../core/services/bunny-upload.service';

function createMockBunnyUploadService() {
  return {
    uploading: signal(false),
    progress: signal(0),
    error: signal(''),
    uploadedVideoId: signal<string | null>(null),
    uploadedLibraryId: signal(0),
    initAndUpload: vi.fn(),
    pollStatus: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn(),
  };
}

function defaultProviders() {
  return [
    { provide: BunnyUploadService, useValue: createMockBunnyUploadService() },
  ];
}

describe('VideoFormComponent', () => {
  it('should render title and description fields', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should show file picker when no video uploaded', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData({ bunny_video_id: '' }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Click to select a video file')).toBeTruthy();
  });

  it('should show uploaded state when bunny_video_id is set', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData({
          bunny_video_id: 'test-guid',
          original_filename: 'lecture.mp4',
        }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByText('lecture.mp4')).toBeTruthy();
    expect(screen.getByText('Video uploaded successfully')).toBeTruthy();
    expect(screen.getByText('Replace')).toBeTruthy();
  });

  it('should show "Create Module" button text in create mode', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" in edit mode', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '' }),
        initialVideoData: createMockVideoFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should disable save when bunny_video_id is empty', async () => {
    await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData({ bunny_video_id: '' }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with correct Bunny payload', async () => {
    const moduleData = createMockModuleFormData({ title: 'My Video', description: 'desc' });
    const videoData = createMockVideoFormData({
      bunny_video_id: 'test-guid',
      bunny_library_id: 12345,
      original_filename: 'lecture.mp4',
    });

    const { fixture } = await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: moduleData,
        initialVideoData: videoData,
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => {
      emittedPayload = p;
    });

    fireEvent.click(screen.getByText('Create Module'));

    expect(emittedPayload).toEqual({
      module: {
        title: 'My Video',
        description: 'desc',
        module_type: 'video',
        lecture_id: 'lecture-1',
        estimated_duration_minutes: 15,
      },
      content: {
        type: 'video',
        data: {
          bunny_video_id: 'test-guid',
          bunny_library_id: 12345,
          original_filename: 'lecture.mp4',
        },
      },
    });
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    let cancelled = false;
    fixture.componentInstance.cancel.subscribe(() => {
      cancelled = true;
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(cancelled).toBe(true);
  });

  it('should show file picker after clicking Replace', async () => {
    const { fixture } = await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData({
          bunny_video_id: 'test-guid',
          original_filename: 'existing.mp4',
        }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    fireEvent.click(screen.getByText('Replace'));
    fixture.detectChanges();

    expect(screen.getByText('Click to select a video file')).toBeTruthy();
  });

  it('should clear upload check interval on destroy', async () => {
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const bunnyUpload = createMockBunnyUploadService();

    const { fixture } = await render(VideoFormComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData({ bunny_video_id: '' }),
        courseId: 'course-1',
      },
      providers: [
        { provide: BunnyUploadService, useValue: bunnyUpload },
      ],
    });

    // Trigger upload to start the interval
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]');
    const mockFile = new File(['video'], 'test.mp4', { type: 'video/mp4' });
    Object.defineProperty(fileInput, 'files', { value: [mockFile] });
    fireEvent.change(fileInput);
    fixture.detectChanges();

    fireEvent.click(screen.getByText('Upload'));
    fixture.detectChanges();

    // Destroy component — should clear the interval
    clearIntervalSpy.mockClear();
    fixture.destroy();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
