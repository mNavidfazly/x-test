import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService, DashboardCounts } from './dashboard.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { AuthService } from '../../core/services/auth.service';
import { createMockSupabaseService, MockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService, MockAuthService } from '../../__mocks__/auth.mock';

describe('DashboardService', () => {
  let service: DashboardService;
  let mockSupabase: MockSupabaseService;
  let mockAuth: MockAuthService;

  function setupService(authOptions?: Parameters<typeof createMockAuthService>[0]) {
    mockSupabase = createMockSupabaseService();
    mockAuth = createMockAuthService({
      isAuthenticated: true,
      ...authOptions,
    });

    TestBed.configureTestingModule({
      providers: [
        DashboardService,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AuthService, useValue: mockAuth },
      ],
    });

    service = TestBed.inject(DashboardService);
  }

  function mockCountResponse(count: number) {
    mockSupabase._mockQueryBuilder.then.mockImplementationOnce(
      (resolve: (v: { data: null; error: null; count: number }) => void) =>
        resolve({ data: null, error: null, count }),
    );
  }

  function mockCountError(message: string) {
    mockSupabase._mockQueryBuilder.then.mockImplementationOnce(
      (_resolve: unknown, reject: (v: unknown) => void) => {
        // Promise.allSettled catches, so we throw from the #count method
      },
    );
    mockSupabase._mockQueryBuilder.is.mockReturnValueOnce({
      then: vi.fn((_resolve: unknown, reject: (v: unknown) => void) => {
        throw { message };
      }),
    });
  }

  describe('initial state', () => {
    beforeEach(() => setupService());

    it('should have empty counts', () => {
      const counts = service.counts();
      expect(counts.pendingAccessRequests).toBeNull();
      expect(counts.totalUsers).toBeNull();
    });

    it('should not be loading', () => {
      expect(service.loading()).toBe(false);
    });

    it('should have no error', () => {
      expect(service.error()).toBeNull();
    });
  });

  describe('loadCounts — pure learner', () => {
    beforeEach(() => {
      setupService({ roles: ['learner'] });
    });

    it('should not query any tables', async () => {
      await service.loadCounts();
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });

    it('should set loading to false after load', async () => {
      await service.loadCounts();
      expect(service.loading()).toBe(false);
    });

    it('should keep all counts as null', async () => {
      await service.loadCounts();
      const counts = service.counts();
      expect(counts.pendingAccessRequests).toBeNull();
      expect(counts.openIssues).toBeNull();
      expect(counts.ungradedExams).toBeNull();
      expect(counts.unansweredQuestions).toBeNull();
      expect(counts.totalUsers).toBeNull();
      expect(counts.totalCourses).toBeNull();
      expect(counts.totalTenants).toBeNull();
    });
  });

  describe('loadCounts — tenant admin', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'tenant_admin'],
        claims: { is_tenant_admin: true },
      });
    });

    it('should query access_requests and profiles', async () => {
      mockCountResponse(3); // pending access requests
      mockCountResponse(45); // total users

      await service.loadCounts();

      expect(mockSupabase.client.from).toHaveBeenCalledWith('access_requests');
      expect(mockSupabase.client.from).toHaveBeenCalledWith('profiles');
      expect(mockSupabase._mockQueryBuilder.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should set correct counts', async () => {
      mockCountResponse(3);
      mockCountResponse(45);

      await service.loadCounts();

      expect(service.counts().pendingAccessRequests).toBe(3);
      expect(service.counts().totalUsers).toBe(45);
    });

    it('should NOT query issues, expert_questions, exam_submissions, courses, tenants', async () => {
      mockCountResponse(0);
      mockCountResponse(0);

      await service.loadCounts();

      const calledTables = (mockSupabase.client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
      expect(calledTables).not.toContain('issues');
      expect(calledTables).not.toContain('expert_questions');
      expect(calledTables).not.toContain('exam_submissions');
      expect(calledTables).not.toContain('courses');
      expect(calledTables).not.toContain('tenants');
    });
  });

  describe('loadCounts — lecturer with can_grade', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'lecturer'],
        claims: {
          lecturer_course_ids: ['course-1'],
          lecturer_can_grade_course_ids: ['course-1'],
        },
      });
    });

    it('should query issues, expert_questions, and exam_submissions', async () => {
      mockCountResponse(5); // open issues
      mockCountResponse(4); // unanswered questions
      mockCountResponse(2); // ungraded exams

      await service.loadCounts();

      const calledTables = (mockSupabase.client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
      expect(calledTables).toContain('issues');
      expect(calledTables).toContain('expert_questions');
      expect(calledTables).toContain('exam_submissions');
    });

    it('should set correct counts', async () => {
      mockCountResponse(5);
      mockCountResponse(4);
      mockCountResponse(2);

      await service.loadCounts();

      expect(service.counts().openIssues).toBe(5);
      expect(service.counts().unansweredQuestions).toBe(4);
      expect(service.counts().ungradedExams).toBe(2);
    });

    it('should NOT query admin tables', async () => {
      mockCountResponse(0);
      mockCountResponse(0);
      mockCountResponse(0);

      await service.loadCounts();

      const calledTables = (mockSupabase.client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
      expect(calledTables).not.toContain('access_requests');
      expect(calledTables).not.toContain('profiles');
      expect(calledTables).not.toContain('courses');
      expect(calledTables).not.toContain('tenants');
    });
  });

  describe('loadCounts — lecturer WITHOUT can_grade', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'lecturer'],
        claims: {
          lecturer_course_ids: ['course-1'],
          lecturer_can_edit_course_ids: ['course-1'],
          lecturer_can_grade_course_ids: [],
        },
      });
    });

    it('should query issues and expert_questions but NOT exam_submissions', async () => {
      mockCountResponse(2); // open issues
      mockCountResponse(1); // unanswered questions

      await service.loadCounts();

      const calledTables = (mockSupabase.client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
      expect(calledTables).toContain('issues');
      expect(calledTables).toContain('expert_questions');
      expect(calledTables).not.toContain('exam_submissions');
    });
  });

  describe('loadCounts — platform admin', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'platform_admin'],
        claims: { is_platform_admin: true },
      });
    });

    it('should query all 7 tables', async () => {
      for (let i = 0; i < 7; i++) mockCountResponse(i + 1);

      await service.loadCounts();

      const calledTables = (mockSupabase.client.from as ReturnType<typeof vi.fn>).mock.calls.map((c: unknown[]) => c[0]);
      expect(calledTables).toContain('access_requests');
      expect(calledTables).toContain('profiles');
      expect(calledTables).toContain('issues');
      expect(calledTables).toContain('expert_questions');
      expect(calledTables).toContain('exam_submissions');
      expect(calledTables).toContain('courses');
      expect(calledTables).toContain('tenants');
    });

    it('should set all counts', async () => {
      mockCountResponse(3);  // pending access requests
      mockCountResponse(100); // total users
      mockCountResponse(5);  // open issues
      mockCountResponse(4);  // unanswered questions
      mockCountResponse(2);  // ungraded exams
      mockCountResponse(12); // total courses
      mockCountResponse(6);  // total tenants

      await service.loadCounts();

      const counts = service.counts();
      expect(counts.pendingAccessRequests).toBe(3);
      expect(counts.totalUsers).toBe(100);
      expect(counts.openIssues).toBe(5);
      expect(counts.unansweredQuestions).toBe(4);
      expect(counts.ungradedExams).toBe(2);
      expect(counts.totalCourses).toBe(12);
      expect(counts.totalTenants).toBe(6);
    });
  });

  describe('loadCounts — CSM', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'csm'],
        claims: { csm_tenant_ids: ['tenant-1', 'tenant-2'] },
      });
    });

    it('should not query any tables (CSM has no action items)', async () => {
      await service.loadCounts();
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'tenant_admin'],
        claims: { is_tenant_admin: true },
      });
    });

    it('should set loading true during load', async () => {
      let loadingDuringCall = false;
      mockSupabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (v: { data: null; error: null; count: number }) => void) => {
          loadingDuringCall = service.loading();
          resolve({ data: null, error: null, count: 0 });
        },
      );
      mockCountResponse(0);

      await service.loadCounts();
      expect(loadingDuringCall).toBe(true);
      expect(service.loading()).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      setupService({
        roles: ['learner', 'tenant_admin'],
        claims: { is_tenant_admin: true },
      });
    });

    it('should handle query errors gracefully via Promise.allSettled', async () => {
      // First query fails, second succeeds
      mockSupabase._mockQueryBuilder.then
        .mockImplementationOnce(() => { throw { message: 'RLS denied' }; })
        .mockImplementationOnce(
          (resolve: (v: { data: null; error: null; count: number }) => void) =>
            resolve({ data: null, error: null, count: 10 }),
        );

      await service.loadCounts();

      // Should still get the successful count
      expect(service.counts().totalUsers).toBe(10);
      expect(service.loading()).toBe(false);
    });
  });

  describe('no authenticated user', () => {
    beforeEach(() => {
      setupService({ isAuthenticated: false });
    });

    it('should return early without querying', async () => {
      await service.loadCounts();
      expect(mockSupabase.client.from).not.toHaveBeenCalled();
      expect(service.loading()).toBe(false);
    });
  });
});
