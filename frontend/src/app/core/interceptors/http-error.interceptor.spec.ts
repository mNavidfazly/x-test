import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { httpErrorInterceptor, isToastedByInterceptor } from './http-error.interceptor';
import { ToastService } from '../services/toast.service';
import { createMockToastService } from '../../__mocks__/toast.mock';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let toast: ReturnType<typeof createMockToastService>;

  beforeEach(() => {
    toast = createMockToastService();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([httpErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('should pass through successful responses without toast', () => {
    let result: unknown;
    http.get('/api/test').subscribe((r) => (result = r));

    httpTesting.expectOne('/api/test').flush({ ok: true });
    expect(result).toEqual({ ok: true });
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('should retry once on 500 and toast server error', () => {
    vi.useFakeTimers();
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });

    // First request → 500
    httpTesting.expectOne('/api/test').flush('fail', { status: 500, statusText: 'Server Error' });

    // Advance past retry delay
    vi.advanceTimersByTime(1100);

    // Second request (retry) → also 500
    httpTesting.expectOne('/api/test').flush('fail', { status: 500, statusText: 'Server Error' });

    expect(error).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Server error. Please try again later.');

    vi.useRealTimers();
  });

  it('should retry once on network error (status 0) and toast', () => {
    vi.useFakeTimers();
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });

    // First request → network error
    httpTesting.expectOne('/api/test').error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    vi.advanceTimersByTime(1100);

    // Retry also fails
    httpTesting.expectOne('/api/test').error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(error).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Network error. Please check your connection.');

    vi.useRealTimers();
  });

  it('should not retry on 403 and toast permission error', () => {
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });
    httpTesting.expectOne('/api/test').flush('forbidden', { status: 403, statusText: 'Forbidden' });

    // No retry — should be only 1 request
    httpTesting.expectNone('/api/test');
    expect(error).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('You do not have permission to perform this action.');
  });

  it('should toast warning on 429', () => {
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });
    httpTesting.expectOne('/api/test').flush('rate limited', { status: 429, statusText: 'Too Many Requests' });

    httpTesting.expectNone('/api/test');
    expect(error).toBeTruthy();
    expect(toast.warning).toHaveBeenCalledWith('Too many requests. Please wait a moment.');
  });

  it('should not toast on 401 (auth handler covers it)', () => {
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });
    httpTesting.expectOne('/api/test').flush('unauthorized', { status: 401, statusText: 'Unauthorized' });

    httpTesting.expectNone('/api/test');
    expect(error).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('should not toast on 404 (callers handle it)', () => {
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });
    httpTesting.expectOne('/api/test').flush('not found', { status: 404, statusText: 'Not Found' });

    httpTesting.expectNone('/api/test');
    expect(error).toBeTruthy();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('should always re-throw error to caller', () => {
    let error: unknown;

    http.get('/api/test').subscribe({ error: (e) => (error = e) });
    httpTesting.expectOne('/api/test').flush('forbidden', { status: 403, statusText: 'Forbidden' });

    expect(error).toBeTruthy();
    expect((error as any).status).toBe(403);
  });

  it('should NOT retry POST requests on 500 (non-idempotent)', () => {
    let error: unknown;

    http.post('/api/invite', { email: 'test@test.com' }).subscribe({ error: (e) => (error = e) });

    // First request → 500
    httpTesting.expectOne('/api/invite').flush('fail', { status: 500, statusText: 'Server Error' });

    // No retry — should be only 1 request
    httpTesting.expectNone('/api/invite');
    expect(error).toBeTruthy();
    expect(toast.error).toHaveBeenCalledWith('Server error. Please try again later.');
  });

  describe('isToastedByInterceptor', () => {
    it('should return true for HttpErrorResponse with status 0', () => {
      const err = new HttpErrorResponse({ status: 0 });
      expect(isToastedByInterceptor(err)).toBe(true);
    });

    it('should return true for HttpErrorResponse with status 403', () => {
      const err = new HttpErrorResponse({ status: 403 });
      expect(isToastedByInterceptor(err)).toBe(true);
    });

    it('should return true for HttpErrorResponse with status 500', () => {
      const err = new HttpErrorResponse({ status: 500 });
      expect(isToastedByInterceptor(err)).toBe(true);
    });

    it('should return false for HttpErrorResponse with status 404', () => {
      const err = new HttpErrorResponse({ status: 404 });
      expect(isToastedByInterceptor(err)).toBe(false);
    });

    it('should return false for non-HttpErrorResponse errors', () => {
      expect(isToastedByInterceptor(new Error('fail'))).toBe(false);
      expect(isToastedByInterceptor('string error')).toBe(false);
    });
  });
});
