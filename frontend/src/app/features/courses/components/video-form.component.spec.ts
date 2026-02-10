import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { VideoFormComponent } from './video-form.component';
import { createMockModuleFormData, createMockVideoFormData } from '../../../__mocks__/course.mock';
import { ModuleSavePayload } from '../../../core/models/course.model';

describe('VideoFormComponent', () => {
  it('should render all form fields', async () => {
    await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
      },
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByLabelText('Video URL')).toBeTruthy();
    expect(screen.getByLabelText('Thumbnail URL')).toBeTruthy();
    expect(screen.getByLabelText('Duration (seconds)')).toBeTruthy();
  });

  it('should pre-populate fields from initialModuleData and initialVideoData', async () => {
    await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Existing Module', description: 'Module desc' }),
        initialVideoData: createMockVideoFormData({
          video_url: 'https://cdn.bunny.net/existing.mp4',
          thumbnail_url: 'https://cdn.bunny.net/thumb.jpg',
          duration: 120,
        }),
      },
    });

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
    const videoUrlInput = screen.getByLabelText('Video URL') as HTMLInputElement;
    const thumbnailUrlInput = screen.getByLabelText('Thumbnail URL') as HTMLInputElement;
    const durationInput = screen.getByLabelText('Duration (seconds)') as HTMLInputElement;

    expect(titleInput.value).toBe('Existing Module');
    expect(descInput.value).toBe('Module desc');
    expect(videoUrlInput.value).toBe('https://cdn.bunny.net/existing.mp4');
    expect(thumbnailUrlInput.value).toBe('https://cdn.bunny.net/thumb.jpg');
    expect(durationInput.value).toBe('120');
  });

  it('should show "Create Module" button text in create mode', async () => {
    await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
      },
    });

    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" button text in edit mode', async () => {
    await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '' }),
        initialVideoData: createMockVideoFormData(),
      },
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should disable save when video URL is empty', async () => {
    await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData({ video_url: '' }),
      },
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with correct payload on valid submit', async () => {
    const moduleData = createMockModuleFormData({ title: 'My Video Module', description: 'A description' });
    const videoData = createMockVideoFormData({
      video_url: 'https://cdn.bunny.net/video.mp4',
      thumbnail_url: 'https://cdn.bunny.net/thumb.jpg',
      duration: 300,
    });

    const { fixture } = await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: moduleData,
        initialVideoData: videoData,
      },
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((payload: ModuleSavePayload) => {
      emittedPayload = payload;
    });

    fireEvent.click(screen.getByText('Create Module'));

    expect(emittedPayload).toEqual({
      module: {
        title: 'My Video Module',
        description: 'A description',
        module_type: 'video',
        lecture_id: 'lecture-1',
      },
      content: {
        type: 'video',
        data: {
          video_url: 'https://cdn.bunny.net/video.mp4',
          thumbnail_url: 'https://cdn.bunny.net/thumb.jpg',
          duration: 300,
        },
      },
    });
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(VideoFormComponent, {
      componentInputs: {
        initialModuleData: createMockModuleFormData(),
        initialVideoData: createMockVideoFormData(),
      },
    });

    let cancelled = false;
    fixture.componentInstance.cancel.subscribe(() => {
      cancelled = true;
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(cancelled).toBe(true);
  });
});
