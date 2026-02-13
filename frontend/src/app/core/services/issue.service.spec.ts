import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { IssueService } from './issue.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('IssueService', () => {
  let service: IssueService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({ isAuthenticated: true, userId: 'user-1', tenantId: 'tenant-1', claims: { tenant_id: 'tenant-1' } });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        IssueService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(IssueService);
  });

  it('should have empty initial state', () => {
    expect(service.issues()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadMyIssues', () => {
    it('should load issues with joined data', async () => {
      const mockIssues = [
        {
          id: 'iss-1', user_id: 'user-1', tenant_id: 'tenant-1', course_id: 'c1', module_id: 'mod-1',
          description: 'Typo on slide 3', issue_type: 'content_error', status: 'open',
          resolved_at: null, resolved_by: null,
          created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
          course: { title: 'Test Course' },
          module: { title: 'Test Module' },
        },
      ];
      supabase._mockQueryResponse(mockIssues);

      await service.loadMyIssues();

      expect(service.issues().length).toBe(1);
      expect(service.issues()[0].description).toBe('Typo on slide 3');
      expect(service.issues()[0].course?.title).toBe('Test Course');
      expect(service.issues()[0].module?.title).toBe('Test Module');
      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');
    });

    it('should handle null FK joins gracefully', async () => {
      const mockIssues = [
        {
          id: 'iss-2', user_id: 'user-1', tenant_id: 'tenant-1', course_id: 'c1', module_id: null,
          description: 'General issue', issue_type: 'technical', status: 'investigating',
          resolved_at: null, resolved_by: null,
          created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
          course: null, module: null,
        },
      ];
      supabase._mockQueryResponse(mockIssues);

      await service.loadMyIssues();

      expect(service.issues()[0].course).toBeNull();
      expect(service.issues()[0].module).toBeNull();
    });

    it('should handle empty list', async () => {
      supabase._mockQueryResponse([]);

      await service.loadMyIssues();

      expect(service.issues()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should set error on failure', async () => {
      supabase._mockQueryResponse(null, { message: 'DB error' });

      await service.loadMyIssues();

      expect(service.error()).toBe('DB error');
      expect(service.loading()).toBe(false);
    });

    it('should set loading to false after error', async () => {
      supabase._mockQueryResponse(null, { message: 'fail' });

      await service.loadMyIssues();

      expect(service.loading()).toBe(false);
    });

    it('should not load if user is not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          IssueService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(IssueService);

      await service.loadMyIssues();

      expect(service.issues()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should query issues_safe view (not base issues table)', async () => {
      supabase._mockQueryResponse([]);

      await service.loadMyIssues();

      expect(supabase.client.from).toHaveBeenCalledWith('issues_safe');
    });
  });

  describe('reportIssue', () => {
    it('should insert with correct fields into base issues table', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        return resolve({ data: callCount === 1 ? null : [], error: null });
      });

      await service.reportIssue('course-1', 'mod-1', 'content_error', 'Typo on slide 3');

      expect(supabase.client.from).toHaveBeenCalledWith('issues');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          course_id: 'course-1',
          module_id: 'mod-1',
          user_id: 'user-1',
          tenant_id: 'tenant-1',
          issue_type: 'content_error',
          description: 'Typo on slide 3',
        }),
      );
    });

    it('should throw when not authenticated', async () => {
      auth = createMockAuthService({ isAuthenticated: false });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          IssueService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: auth },
        ],
      });
      service = TestBed.inject(IssueService);

      await expect(service.reportIssue('c1', 'mod-1', 'technical', 'desc')).rejects.toThrow('Not authenticated');
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Insert failed' } }),
      );

      await expect(service.reportIssue('c1', 'mod-1', 'technical', 'desc')).rejects.toThrow('Insert failed');
    });
  });
});
