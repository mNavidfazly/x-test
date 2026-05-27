import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ExamGradingService } from './exam-grading.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('ExamGradingService', () => {
  let service: ExamGradingService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService({ isPlatformAdmin: true });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ExamGradingService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
      ],
    });
    service = TestBed.inject(ExamGradingService);
  });

  function mockRpc(rows: unknown[], error: unknown = null) {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: rows, error });
  }

  it('should have empty initial state', () => {
    expect(service.submissions()).toEqual([]);
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadGradingData', () => {
    it('should call get_exam_grading_data RPC and map rows', async () => {
      mockRpc([{
        submission_id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c1',
        file_url: 'c1/u1/file.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
        score: null, feedback: null, graded_by: null, graded_at: null,
        learner_email: 'learner@test.com', learner_full_name: 'Test Learner', learner_avatar_url: null,
        exam_title: 'Final Exam', passing_score: 70, course_title: 'Test Course',
      }]);

      await service.loadGradingData();

      expect(supabase.client.rpc).toHaveBeenCalledWith('get_exam_grading_data');
      const subs = service.submissions();
      expect(subs).toHaveLength(1);
      expect(subs[0].id).toBe('sub-1');
      expect(subs[0].learner_email).toBe('learner@test.com');
      expect(subs[0].learner_name).toBe('Test Learner');
      expect(subs[0].course_title).toBe('Test Course');
      expect(subs[0].exam_title).toBe('Final Exam');
      expect(subs[0].passing_score).toBe(70);
      expect(subs[0].file_storage_path).toBe('c1/u1/file.pdf');

      expect(service.courses()).toEqual([{ id: 'c1', title: 'Test Course' }]);
    });

    it('should resolve signed URLs for file_url', async () => {
      mockRpc([{
        submission_id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c1',
        file_url: 'c1/u1/file.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
        score: null, feedback: null, graded_by: null, graded_at: null,
        learner_email: 'a@t.com', learner_full_name: null, learner_avatar_url: null,
        exam_title: 'Exam', passing_score: 70, course_title: 'Course',
      }]);

      await service.loadGradingData();

      expect(service.submissions()[0].file_url).toContain('sign');
      expect(supabase.client.storage.from).toHaveBeenCalledWith('exam-submissions');
    });

    it('should set error on RPC failure', async () => {
      mockRpc(null, { message: 'Permission denied' });
      await service.loadGradingData();
      expect(service.error()).toBe('Permission denied');
      expect(service.submissions()).toEqual([]);
    });

    it('should handle empty data', async () => {
      mockRpc([]);
      await service.loadGradingData();
      expect(service.submissions()).toEqual([]);
      expect(service.courses()).toEqual([]);
    });

    it('should set loading signal during load', async () => {
      mockRpc([]);
      const promise = service.loadGradingData();
      expect(service.loading()).toBe(true);
      await promise;
      expect(service.loading()).toBe(false);
    });

    it('should sort courses alphabetically', async () => {
      mockRpc([
        { submission_id: 's1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c2',
          file_url: 'c2/u1/f.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
          score: null, feedback: null, graded_by: null, graded_at: null,
          learner_email: 'a@t.com', learner_full_name: null, learner_avatar_url: null,
          exam_title: 'E', passing_score: 70, course_title: 'Zulu Course' },
        { submission_id: 's2', user_id: 'u2', tenant_id: 't1', exam_id: 'e2', course_id: 'c1',
          file_url: 'c1/u2/f.pdf', submitted_at: '2026-02-13T09:00:00Z', deadline: '2026-02-13T10:00:00Z',
          score: 85, feedback: 'Good', graded_by: 'g1', graded_at: '2026-02-13T12:00:00Z',
          learner_email: 'b@t.com', learner_full_name: null, learner_avatar_url: null,
          exam_title: 'E2', passing_score: 60, course_title: 'Alpha Course' },
      ]);

      await service.loadGradingData();
      expect(service.courses().map(c => c.title)).toEqual(['Alpha Course', 'Zulu Course']);
    });
  });

  describe('gradeSubmission', () => {
    it('should call update with correct payload', async () => {
      supabase._mockQueryResponse(null);
      await service.gradeSubmission('sub-1', { score: 85, feedback: 'Well done' });
      expect(supabase.client.from).toHaveBeenCalledWith('exam_submissions');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ score: 85, feedback: 'Well done', graded_by: 'test-user-id' }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sub-1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryResponse(null, { message: 'Update failed' });
      await expect(service.gradeSubmission('sub-1', { score: 85, feedback: '' }))
        .rejects.toThrow('Update failed');
    });
  });

  describe('resetSubmission', () => {
    it('should delete submission and clean up storage', async () => {
      // Seed via RPC load first
      mockRpc([{
        submission_id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c1',
        file_url: 'c1/u1/file.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
        score: null, feedback: null, graded_by: null, graded_at: null,
        learner_email: 'a@t.com', learner_full_name: null, learner_avatar_url: null,
        exam_title: 'Exam', passing_score: 70, course_title: 'Course',
      }]);
      await service.loadGradingData();

      supabase._mockQueryResponse(null);
      await service.resetSubmission('sub-1');

      expect(supabase.client.from).toHaveBeenCalledWith('exam_submissions');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sub-1');
      expect(supabase.client.storage.from).toHaveBeenCalledWith('exam-submissions');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryResponse(null, { message: 'Delete failed' });
      await expect(service.resetSubmission('sub-1')).rejects.toThrow('Delete failed');
    });
  });
});
