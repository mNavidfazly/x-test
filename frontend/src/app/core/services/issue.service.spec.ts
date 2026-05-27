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

  // --- Board tests (Lecturer / Platform Admin) ---

  it('should have empty initial board state', () => {
    expect(service.boardIssues()).toEqual([]);
    expect(service.boardCourses()).toEqual([]);
    expect(service.boardLoading()).toBe(false);
    expect(service.boardError()).toBe('');
  });

  describe('loadBoardIssues', () => {
    function mockBoardRpc(rows: unknown[], error: unknown = null) {
      supabase.client.rpc = vi.fn().mockResolvedValue({ data: rows, error });
    }

    it('should call get_issues_board_data RPC and load issues with reporter', async () => {
      mockBoardRpc([{
        issue_id: 'iss-1', user_id: 'user-1', tenant_id: 'tenant-1', course_id: 'c1', module_id: 'mod-1',
        description: 'Typo on slide 3', issue_type: 'content_error', status: 'open',
        internal_notes: 'Checking with author', resolved_at: null, resolved_by: null,
        created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
        course_title: 'Alpha Course', module_title: 'Lesson 1',
        reporter_full_name: 'Test Learner', reporter_email: 'learner@test.com', reporter_avatar_url: null,
      }]);

      await service.loadBoardIssues();

      expect(supabase.client.rpc).toHaveBeenCalledWith('get_issues_board_data');
      expect(service.boardIssues().length).toBe(1);
      expect(service.boardIssues()[0].reporter?.email).toBe('learner@test.com');
      expect(service.boardIssues()[0].internal_notes).toBe('Checking with author');
      expect(service.boardLoading()).toBe(false);
      expect(service.boardError()).toBe('');
    });

    it('should handle null FK joins gracefully', async () => {
      mockBoardRpc([{
        issue_id: 'iss-2', user_id: 'user-1', tenant_id: 'tenant-1', course_id: 'c1', module_id: null,
        description: 'General issue', issue_type: 'technical', status: 'open',
        internal_notes: null, resolved_at: null, resolved_by: null,
        created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
        course_title: null, module_title: null,
        reporter_full_name: null, reporter_email: null, reporter_avatar_url: null,
      }]);

      await service.loadBoardIssues();

      expect(service.boardIssues()[0].course).toBeNull();
      expect(service.boardIssues()[0].module).toBeNull();
      expect(service.boardIssues()[0].reporter).toBeNull();
    });

    it('should handle empty list', async () => {
      mockBoardRpc([]);
      await service.loadBoardIssues();
      expect(service.boardIssues()).toEqual([]);
      expect(service.boardCourses()).toEqual([]);
      expect(service.boardLoading()).toBe(false);
    });

    it('should set error on failure', async () => {
      mockBoardRpc(null, { message: 'DB error' });
      await service.loadBoardIssues();
      expect(service.boardError()).toBe('DB error');
      expect(service.boardLoading()).toBe(false);
    });

    it('should set loading to false after completion', async () => {
      mockBoardRpc([]);
      await service.loadBoardIssues();
      expect(service.boardLoading()).toBe(false);
    });

    it('should derive courses sorted alphabetically', async () => {
      mockBoardRpc([
        { issue_id: 'iss-1', user_id: 'u1', tenant_id: 't1', course_id: 'c2', module_id: null,
          description: 'd', issue_type: 'technical', status: 'open',
          internal_notes: null, resolved_at: null, resolved_by: null,
          created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
          course_title: 'Zebra Course', module_title: null,
          reporter_full_name: null, reporter_email: null, reporter_avatar_url: null },
        { issue_id: 'iss-2', user_id: 'u1', tenant_id: 't1', course_id: 'c1', module_id: null,
          description: 'd', issue_type: 'technical', status: 'open',
          internal_notes: null, resolved_at: null, resolved_by: null,
          created_at: '2026-02-01T10:00:00Z', updated_at: '2026-02-01T10:00:00Z',
          course_title: 'Alpha Course', module_title: null,
          reporter_full_name: null, reporter_email: null, reporter_avatar_url: null },
      ]);

      await service.loadBoardIssues();
      expect(service.boardCourses().map(c => c.title)).toEqual(['Alpha Course', 'Zebra Course']);
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

      await service.loadBoardIssues();

      expect(service.boardError()).toBe('Not authenticated');
    });
  });

  describe('updateIssue', () => {
    it('should update status and internal_notes', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: null }) => void) =>
        resolve({ data: null, error: null }),
      );

      await service.updateIssue('iss-1', { status: 'investigating', internal_notes: 'Looking into it' });

      expect(supabase.client.from).toHaveBeenCalledWith('issues');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'investigating',
          internal_notes: 'Looking into it',
          resolved_by: null,
          resolved_at: null,
        }),
      );
    });

    it('should auto-set resolved_by and resolved_at when resolving', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: null }) => void) =>
        resolve({ data: null, error: null }),
      );

      await service.updateIssue('iss-1', { status: 'resolved' });

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved',
          resolved_by: 'user-1',
        }),
      );
      const updateArg = (supabase._mockQueryBuilder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(updateArg.resolved_at).toBeTruthy();
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

      await expect(service.updateIssue('iss-1', { status: 'investigating' })).rejects.toThrow('Not authenticated');
    });

    it('should throw on update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementationOnce((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Update failed' } }),
      );

      await expect(service.updateIssue('iss-1', { status: 'closed' })).rejects.toThrow('Update failed');
    });
  });
});
