import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { SupabaseTusUploadService } from './supabase-tus-upload.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService, MockSupabaseService } from '../../__mocks__/supabase.mock';

// Capture tus.Upload constructor options so tests can invoke callbacks
let capturedOptions: Record<string, any> = {};
const mockStart = vi.fn();
const mockAbort = vi.fn();
const mockFindPreviousUploads = vi.fn().mockResolvedValue([]);
const mockResumeFromPreviousUpload = vi.fn();

vi.mock('tus-js-client', () => ({
  Upload: vi.fn().mockImplementation((_file, options) => {
    capturedOptions = options;
    return {
      start: mockStart,
      abort: mockAbort,
      findPreviousUploads: mockFindPreviousUploads,
      resumeFromPreviousUpload: mockResumeFromPreviousUpload,
    };
  }),
}));

describe('SupabaseTusUploadService', () => {
  let service: SupabaseTusUploadService;
  let supabase: MockSupabaseService;

  const testFile = new File(['test-content'], 'document.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    capturedOptions = {};
    mockStart.mockClear();
    mockAbort.mockClear();
    mockFindPreviousUploads.mockReset().mockResolvedValue([]);
    mockResumeFromPreviousUpload.mockClear();

    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        SupabaseTusUploadService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(SupabaseTusUploadService);
  });

  it('should start with default signal values', () => {
    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(0);
    expect(service.error()).toBeNull();
    expect(service.uploadedPath()).toBeNull();
  });

  it('should throw when not authenticated', async () => {
    supabase.client.auth.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: null,
    });

    await expect(service.upload('course-files', 'test/file.pdf', testFile))
      .rejects.toThrow('Not authenticated');

    expect(service.uploading()).toBe(false);
  });

  it('should resolve with path and set signals on successful upload', async () => {
    // findPreviousUploads resolves then start is called; we trigger onSuccess inside start
    mockStart.mockImplementation(() => {
      capturedOptions.onSuccess();
    });

    const result = await service.upload('course-files', 'courses/doc.pdf', testFile);

    expect(result).toBe('courses/doc.pdf');
    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(100);
    expect(service.uploadedPath()).toBe('courses/doc.pdf');
    expect(service.error()).toBeNull();
  });

  it('should set error signal and reject on upload error', async () => {
    const uploadError = new Error('Network failure');
    mockStart.mockImplementation(() => {
      capturedOptions.onError(uploadError);
    });

    await expect(service.upload('course-files', 'test/file.pdf', testFile))
      .rejects.toThrow('Network failure');

    expect(service.uploading()).toBe(false);
    expect(service.error()).toBe('Network failure');
  });

  it('should update progress signal via onProgress callback', async () => {
    const progressValues: number[] = [];

    mockStart.mockImplementation(() => {
      capturedOptions.onProgress(25, 100);
      progressValues.push(service.progress());

      capturedOptions.onProgress(50, 100);
      progressValues.push(service.progress());

      capturedOptions.onProgress(75, 100);
      progressValues.push(service.progress());

      capturedOptions.onSuccess();
    });

    await service.upload('course-files', 'test/file.pdf', testFile);

    expect(progressValues).toEqual([25, 50, 75]);
    expect(service.progress()).toBe(100);
  });

  it('should pass correct metadata, headers, and endpoint to tus Upload', async () => {
    mockStart.mockImplementation(() => {
      capturedOptions.onSuccess();
    });

    await service.upload('exam-submissions', 'exams/user-1/answer.pdf', testFile);

    const tusModule = await import('tus-js-client');
    const UploadMock = tusModule.Upload as unknown as ReturnType<typeof vi.fn>;
    const [file, options] = UploadMock.mock.calls.at(-1)!;

    expect(file).toBe(testFile);
    expect(options.endpoint).toBe(
      'https://ruhdnvtvoxxiodnyyqqf.storage.supabase.co/storage/v1/upload/resumable',
    );
    expect(options.headers).toEqual({
      authorization: 'Bearer mock-jwt',
      'x-upsert': 'false',
    });
    expect(options.metadata).toEqual({
      bucketName: 'exam-submissions',
      objectName: 'exams/user-1/answer.pdf',
      contentType: 'application/pdf',
    });
    expect(options.chunkSize).toBe(6 * 1024 * 1024);
    expect(options.removeFingerprintOnSuccess).toBe(true);
  });

  it('should resume from previous upload when one exists', async () => {
    const previousUpload = { uploadUrl: 'https://example.com/resumable/abc123' };
    mockFindPreviousUploads.mockResolvedValueOnce([previousUpload]);

    mockStart.mockImplementation(() => {
      capturedOptions.onSuccess();
    });

    await service.upload('course-files', 'test/file.pdf', testFile);

    expect(mockResumeFromPreviousUpload).toHaveBeenCalledWith(previousUpload);
    expect(mockStart).toHaveBeenCalled();
  });

  it('should abort current upload and reset uploading/progress signals', async () => {
    // Start an upload that does not complete
    mockStart.mockImplementation(() => {
      // intentionally left hanging
    });

    const uploadPromise = service.upload('course-files', 'test/file.pdf', testFile);
    // Let findPreviousUploads resolve so start() is called
    await vi.waitFor(() => expect(mockStart).toHaveBeenCalled());

    expect(service.uploading()).toBe(true);

    service.abort();

    expect(mockAbort).toHaveBeenCalled();
    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(0);

    // Clean up the hanging promise
    capturedOptions.onError(new Error('aborted'));
    await uploadPromise.catch(() => {});
  });

  it('should reset all signals including error and uploadedPath', async () => {
    // First do a successful upload to populate signals
    mockStart.mockImplementation(() => {
      capturedOptions.onSuccess();
    });
    await service.upload('course-files', 'test/file.pdf', testFile);
    expect(service.uploadedPath()).toBe('test/file.pdf');

    service.reset();

    expect(service.uploading()).toBe(false);
    expect(service.progress()).toBe(0);
    expect(service.error()).toBeNull();
    expect(service.uploadedPath()).toBeNull();
  });
});
