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

  it('should have empty initial state', () => {
    expect(service.submissions()).toEqual([]);
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadGradingData', () => {
    function mockSubmissionsQuery(submissions: unknown[], error: unknown = null) {
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown; error: unknown }) => void) =>
          resolve({ data: submissions, error }),
      );
    }

    it('should load submissions and derive courses', async () => {
      mockSubmissionsQuery([
        {
          id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c1',
          file_url: 'c1/u1/file.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
          score: null, feedback: null, graded_by: null, graded_at: null,
          profiles: { email: 'learner@test.com', full_name: 'Test Learner' },
          exams: { title: 'Final Exam', passing_score: 70 },
          courses: { title: 'Test Course' },
        },
      ]);

      await service.loadGradingData();

      expect(service.error()).toBe('');
      expect(service.loading()).toBe(false);

      const subs = service.submissions();
      expect(subs).toHaveLength(1);
      expect(subs[0].learner_email).toBe('learner@test.com');
      expect(subs[0].learner_name).toBe('Test Learner');
      expect(subs[0].course_title).toBe('Test Course');
      expect(subs[0].exam_title).toBe('Final Exam');
      expect(subs[0].passing_score).toBe(70);
      expect(subs[0].file_storage_path).toBe('c1/u1/file.pdf');

      const courses = service.courses();
      expect(courses).toHaveLength(1);
      expect(courses[0]).toEqual({ id: 'c1', title: 'Test Course' });
    });

    it('should resolve signed URLs for file_url', async () => {
      mockSubmissionsQuery([
        {
          id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c1',
          file_url: 'c1/u1/file.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
          score: null, feedback: null, graded_by: null, graded_at: null,
          profiles: { email: 'a@t.com', full_name: null },
          exams: { title: 'Exam', passing_score: 70 },
          courses: { title: 'Course' },
        },
      ]);

      await service.loadGradingData();

      const subs = service.submissions();
      expect(subs[0].file_url).toContain('sign');
      expect(subs[0].file_storage_path).toBe('c1/u1/file.pdf');
      expect(supabase.client.storage.from).toHaveBeenCalledWith('exam-submissions');
    });

    it('should handle query error', async () => {
      mockSubmissionsQuery(null, { message: 'Permission denied' });

      await service.loadGradingData();

      expect(service.error()).toBe('Permission denied');
      expect(service.submissions()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should handle empty data', async () => {
      mockSubmissionsQuery([]);

      await service.loadGradingData();

      expect(service.submissions()).toEqual([]);
      expect(service.courses()).toEqual([]);
      expect(service.error()).toBe('');
    });

    it('should set loading signal during load', async () => {
      mockSubmissionsQuery([]);

      expect(service.loading()).toBe(false);
      const promise = service.loadGradingData();
      expect(service.loading()).toBe(true);
      await promise;
      expect(service.loading()).toBe(false);
    });

    it('should sort courses alphabetically', async () => {
      mockSubmissionsQuery([
        {
          id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c2',
          file_url: 'c2/u1/f.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
          score: null, feedback: null, graded_by: null, graded_at: null,
          profiles: { email: 'a@t.com', full_name: null },
          exams: { title: 'Exam', passing_score: 70 },
          courses: { title: 'Zulu Course' },
        },
        {
          id: 'sub-2', user_id: 'u2', tenant_id: 't1', exam_id: 'e2', course_id: 'c1',
          file_url: 'c1/u2/f.pdf', submitted_at: '2026-02-13T09:00:00Z', deadline: '2026-02-13T10:00:00Z',
          score: 85, feedback: 'Good', graded_by: 'g1', graded_at: '2026-02-13T12:00:00Z',
          profiles: { email: 'b@t.com', full_name: null },
          exams: { title: 'Exam 2', passing_score: 60 },
          courses: { title: 'Alpha Course' },
        },
      ]);

      await service.loadGradingData();

      expect(service.courses()[0].title).toBe('Alpha Course');
      expect(service.courses()[1].title).toBe('Zulu Course');
    });
  });

  describe('gradeSubmission', () => {
    it('should call update with correct payload', async () => {
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.gradeSubmission('sub-1', { score: 85, feedback: 'Well done' });

      expect(supabase.client.from).toHaveBeenCalledWith('exam_submissions');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          score: 85,
          feedback: 'Well done',
          graded_by: 'test-user-id',
        }),
      );
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sub-1');
    });

    it('should throw on error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown; error: unknown }) => void) =>
          resolve({ data: null, error: { message: 'Update failed' } }),
      );

      await expect(service.gradeSubmission('sub-1', { score: 85, feedback: '' }))
        .rejects.toThrow('Update failed');
    });
  });

  describe('resetSubmission', () => {
    it('should delete submission and clean up storage', async () => {
      // Seed submissions signal with a submission that has file_storage_path
      (service as any)['#submissions'] = undefined; // can't access private
      // Instead, load data first to populate submissions
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown; error: null }) => void) =>
          resolve({ data: [
            {
              id: 'sub-1', user_id: 'u1', tenant_id: 't1', exam_id: 'e1', course_id: 'c1',
              file_url: 'c1/u1/file.pdf', submitted_at: '2026-02-13T10:00:00Z', deadline: '2026-02-13T11:00:00Z',
              score: null, feedback: null, graded_by: null, graded_at: null,
              profiles: { email: 'a@t.com', full_name: null },
              exams: { title: 'Exam', passing_score: 70 },
              courses: { title: 'Course' },
            },
          ], error: null }),
      );
      await service.loadGradingData();

      // Mock delete response
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown; error: null }) => void) =>
          resolve({ data: null, error: null }),
      );

      await service.resetSubmission('sub-1');

      expect(supabase.client.from).toHaveBeenCalledWith('exam_submissions');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'sub-1');
      expect(supabase.client.storage.from).toHaveBeenCalledWith('exam-submissions');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation(
        (resolve: (value: { data: unknown; error: unknown }) => void) =>
          resolve({ data: null, error: { message: 'Delete failed' } }),
      );

      await expect(service.resetSubmission('sub-1')).rejects.toThrow('Delete failed');
    });
  });
});
