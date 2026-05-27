import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TeachingOverviewService } from './teaching-overview.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

describe('TeachingOverviewService', () => {
  let service: TeachingOverviewService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TeachingOverviewService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(TeachingOverviewService);
  });

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should set loading during data fetch', async () => {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const promise = service.loadOverview();
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('should call get_teaching_overview RPC', async () => {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await service.loadOverview();
    expect(supabase.client.rpc).toHaveBeenCalledWith('get_teaching_overview');
  });

  it('should map RPC rows to TeachingCourseOverview objects', async () => {
    supabase.client.rpc = vi.fn().mockResolvedValue({
      data: [{
        course_id: 'c1',
        title: 'Course A',
        staleness_threshold_days: 90,
        enrolled_count: 5,
        pending_exams: 2,
        pending_questions: 1,
        open_issues: 3,
        stale_modules: 4,
        total_modules: 10,
        can_edit: true,
        can_grade: true,
      }],
      error: null,
    });

    await service.loadOverview();

    expect(service.courses()).toEqual([{
      id: 'c1',
      title: 'Course A',
      canEdit: true,
      canGrade: true,
      enrolledCount: 5,
      pendingExams: 2,
      pendingQuestions: 1,
      openIssues: 3,
      staleModules: 4,
      totalModules: 10,
      totalActionItems: 2 + 1 + 3 + 4,
    }]);
  });

  it('should sort courses by totalActionItems desc then title asc', async () => {
    supabase.client.rpc = vi.fn().mockResolvedValue({
      data: [
        { course_id: 'c1', title: 'Zebra', staleness_threshold_days: 180, enrolled_count: 0, pending_exams: 0, pending_questions: 0, open_issues: 1, stale_modules: 0, total_modules: 0, can_edit: false, can_grade: false },
        { course_id: 'c2', title: 'Alpha', staleness_threshold_days: 180, enrolled_count: 0, pending_exams: 0, pending_questions: 0, open_issues: 0, stale_modules: 0, total_modules: 0, can_edit: false, can_grade: false },
        { course_id: 'c3', title: 'Beta', staleness_threshold_days: 180, enrolled_count: 0, pending_exams: 0, pending_questions: 2, open_issues: 0, stale_modules: 0, total_modules: 0, can_edit: false, can_grade: false },
      ],
      error: null,
    });

    await service.loadOverview();

    const titles = service.courses().map(c => c.title);
    expect(titles).toEqual(['Beta', 'Zebra', 'Alpha']);
  });

  it('should set error on RPC failure', async () => {
    supabase.client.rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Permission denied' },
    });

    await service.loadOverview();

    expect(service.error()).toBe('Permission denied');
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should handle empty result', async () => {
    supabase.client.rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    await service.loadOverview();
    expect(service.courses()).toEqual([]);
    expect(service.error()).toBe('');
  });
});
