import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { signal } from '@angular/core';
import { of, EMPTY } from 'rxjs';
import { VideoViewerComponent } from './video-viewer.component';
import { createMockModuleVideo } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { BunnyUploadService } from '../../../core/services/bunny-upload.service';

function createMockBunnyUploadService() {
  return {
    uploading: signal(false),
    progress: signal(0),
    error: signal(''),
    uploadedVideoId: signal<string | null>(null),
    uploadedLibraryId: signal(0),
    initAndUpload: vi.fn(),
    pollStatus: vi.fn().mockReturnValue(EMPTY),
    abort: vi.fn(),
    reset: vi.fn(),
  };
}

function defaultProviders() {
  return [
    { provide: BunnyUploadService, useValue: createMockBunnyUploadService() },
  ];
}

describe('VideoViewerComponent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should show processing state for encoding_status < 4', async () => {
    const video = createMockModuleVideo({ encoding_status: 3 });
    await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Video is being processed')).toBeTruthy();
    expect(screen.getByText(/This may take a few minutes/)).toBeTruthy();
  });

  it('should show failed state for encoding_status 5', async () => {
    const video = createMockModuleVideo({ encoding_status: 5 });
    await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Video encoding failed')).toBeTruthy();
    expect(screen.getByText(/re-uploading/)).toBeTruthy();
  });

  it('should show loading when ready but embed URL not yet fetched', async () => {
    const mockService = createMockBunnyUploadService();
    mockService.pollStatus.mockReturnValue(of({
      video_id: 'test-guid',
      status: 4,
      encode_progress: 100,
      duration: 360,
      thumbnail_url: null,
      embed_url: null,
    }));

    const video = createMockModuleVideo({ encoding_status: 4 });
    await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: [{ provide: BunnyUploadService, useValue: mockService }],
    });

    expect(screen.getByText('Loading video...')).toBeTruthy();
  });

  it('should render iframe when embed URL is available', async () => {
    const mockService = createMockBunnyUploadService();
    mockService.pollStatus.mockReturnValue(of({
      video_id: 'test-guid',
      status: 4,
      encode_progress: 100,
      duration: 360,
      thumbnail_url: null,
      embed_url: 'https://iframe.mediadelivery.net/embed/12345/test-guid?token=abc',
    }));

    const video = createMockModuleVideo({ encoding_status: 4 });
    const { fixture } = await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: [{ provide: BunnyUploadService, useValue: mockService }],
    });

    // Allow effect to run and signal to update
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(iframe!.getAttribute('allowfullscreen')).not.toBeNull();
  });

  it('should show formatted duration', async () => {
    const video = createMockModuleVideo({ encoding_status: 4, duration: 125 });
    await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Duration: 2:05')).toBeTruthy();
  });

  it('should hide duration when null', async () => {
    const video = createMockModuleVideo({ encoding_status: 4, duration: null });
    await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: defaultProviders(),
    });

    expect(screen.queryByText(/Duration/)).toBeNull();
  });

  it('should poll for encoding progress when processing', async () => {
    const mockService = createMockBunnyUploadService();
    mockService.pollStatus.mockReturnValue(of({
      video_id: 'test-guid',
      status: 2,
      encode_progress: 45,
      duration: null,
      thumbnail_url: null,
      embed_url: null,
    }));

    const video = createMockModuleVideo({ encoding_status: 1 });
    const { fixture } = await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: [{ provide: BunnyUploadService, useValue: mockService }],
    });

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // pollStatus should have been called (immediate first poll)
    expect(mockService.pollStatus).toHaveBeenCalledWith('test-guid');
    // Progress bar should show 45%
    expect(screen.getByText('Encoding')).toBeTruthy();
    expect(screen.getByText('45%')).toBeTruthy();
  });

  it('should not show progress bar when encode_progress is 0', async () => {
    const mockService = createMockBunnyUploadService();
    mockService.pollStatus.mockReturnValue(of({
      video_id: 'test-guid',
      status: 1,
      encode_progress: 0,
      duration: null,
      thumbnail_url: null,
      embed_url: null,
    }));

    const video = createMockModuleVideo({ encoding_status: 0 });
    const { fixture } = await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: [{ provide: BunnyUploadService, useValue: mockService }],
    });

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Video is being processed')).toBeTruthy();
    expect(screen.queryByText('Encoding')).toBeNull();
  });

  it('should auto-transition to ready when polling detects completion', async () => {
    const mockService = createMockBunnyUploadService();
    mockService.pollStatus.mockReturnValue(of({
      video_id: 'test-guid',
      status: 4,
      encode_progress: 100,
      duration: 360,
      thumbnail_url: null,
      embed_url: 'https://iframe.mediadelivery.net/embed/12345/test-guid?token=abc',
    }));

    const video = createMockModuleVideo({ encoding_status: 0 });
    const { fixture } = await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: [{ provide: BunnyUploadService, useValue: mockService }],
    });

    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    // Should have transitioned from processing to ready with iframe
    const iframe = document.querySelector('iframe');
    expect(iframe).toBeTruthy();
    expect(screen.queryByText('Video is being processed')).toBeNull();
  });

  it('should not poll for failed status', async () => {
    const mockService = createMockBunnyUploadService();

    const video = createMockModuleVideo({ encoding_status: 5 });
    await render(VideoViewerComponent, {
      componentImports: [MockLucideIconComponent],
      componentInputs: { video },
      providers: [{ provide: BunnyUploadService, useValue: mockService }],
    });

    expect(mockService.pollStatus).not.toHaveBeenCalled();
  });
});
