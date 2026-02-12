import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { BunnyUploadService } from './bunny-upload.service';
import { ApiService } from './api.service';
import { createMockApiService, MockApiService } from '../../__mocks__/api.mock';
import { BunnyUploadCredentials } from '../models/course.model';

// Mock tus-js-client
vi.mock('tus-js-client', () => ({
  Upload: vi.fn().mockImplementation((_file, options) => ({
    start: vi.fn().mockImplementation(() => {
      // Simulate immediate success
      if (options.onProgress) options.onProgress(50, 100);
      if (options.onSuccess) options.onSuccess();
    }),
    abort: vi.fn(),
  })),
}));

const mockCredentials: BunnyUploadCredentials = {
  video_id: 'test-video-guid',
  library_id: 12345,
  auth_signature: 'sig-abc',
  auth_expire: 9999999999,
  tus_endpoint: 'https://video.bunnycdn.com/tusupload',
};

describe('BunnyUploadService', () => {
  let service: BunnyUploadService;
  let api: MockApiService;

  beforeEach(() => {
    api = createMockApiService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        BunnyUploadService,
        { provide: ApiService, useValue: api },
      ],
    });
    service = TestBed.inject(BunnyUploadService);
  });

  it('should start with default signal values', () => {
    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(0);
    expect(service.error()).toBe('');
    expect(service.uploadedVideoId()).toBeNull();
  });

  it('should call init-upload API on initAndUpload', () => {
    api.post.mockReturnValue(of(mockCredentials));
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });

    service.initAndUpload(file, 'Test Video', 'course-1');

    expect(api.post).toHaveBeenCalledWith('/video/init-upload', {
      title: 'Test Video',
      course_id: 'course-1',
    });
  });

  it('should set uploadedVideoId on successful upload', () => {
    api.post.mockReturnValue(of(mockCredentials));
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });

    service.initAndUpload(file, 'Test Video', 'course-1');

    expect(service.uploadedVideoId()).toBe('test-video-guid');
    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(100);
  });

  it('should set error on init-upload failure', () => {
    api.post.mockReturnValue(throwError(() => ({ error: { detail: 'Forbidden' } })));
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });

    service.initAndUpload(file, 'Test Video', 'course-1');

    expect(service.error()).toBe('Forbidden');
    expect(service.uploading()).toBe(false);
  });

  it('should call pollStatus via GET', () => {
    const mockStatus = { video_id: 'v1', status: 3, encode_progress: 100, duration: 120, thumbnail_url: null, embed_url: 'https://...' };
    api.get.mockReturnValue(of(mockStatus));

    let result: unknown = null;
    service.pollStatus('v1').subscribe((r) => (result = r));

    expect(api.get).toHaveBeenCalledWith('/video/v1/status');
    expect(result).toEqual(mockStatus);
  });

  it('should reset all signals on reset()', () => {
    api.post.mockReturnValue(of(mockCredentials));
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });
    service.initAndUpload(file, 'Test', 'c1');

    service.reset();

    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(0);
    expect(service.error()).toBe('');
    expect(service.uploadedVideoId()).toBeNull();
  });

  it('should set uploading to true during upload', async () => {
    // Override mock to NOT call onSuccess immediately so we can check intermediate state
    const tusModule = await import('tus-js-client');
    (tusModule.Upload as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce((_file: File, options: Record<string, unknown>) => ({
      start: vi.fn().mockImplementation(() => {
        // Don't call onSuccess — upload is "in progress"
      }),
      abort: vi.fn(),
    }));

    api.post.mockReturnValue(of(mockCredentials));
    const file = new File(['content'], 'test.mp4', { type: 'video/mp4' });

    service.initAndUpload(file, 'Test', 'c1');

    expect(service.uploading()).toBe(true);
  });
});
