import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TeachingOverviewService } from './teaching-overview.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('TeachingOverviewService', () => {
  let service: TeachingOverviewService;
  let supabase: ReturnType<typeof createMockSupabaseService>;
  let auth: ReturnType<typeof createMockAuthService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    auth = createMockAuthService({
      isAuthenticated: true,
      roles: ['lecturer'],
      claims: {
        lecturer_course_ids: ['c1', 'c2'],
        lecturer_can_edit_course_ids: ['c1'],
        lecturer_can_grade_course_ids: ['c1'],
      },
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TeachingOverviewService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(TeachingOverviewService);
  });

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
  const daysFromNow = (n: number) => new Date(now + n * 86_400_000).toISOString();

  function mockResponses(
    courses: unknown[],
    enrollments: unknown[],
    exams: unknown[],
    questions: unknown[],
    issues: unknown[],
    modules: unknown[],
    errors?: { courses?: unknown; enrollments?: unknown; exams?: unknown; questions?: unknown; issues?: unknown; modules?: unknown },
  ) {
    supabase._mockQueryBuilder.then
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: courses, error: errors?.courses ?? null }),
      )
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: enrollments, error: errors?.enrollments ?? null }),
      )
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: exams, error: errors?.exams ?? null }),
      )
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: questions, error: errors?.questions ?? null }),
      )
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: issues, error: errors?.issues ?? null }),
      )
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: modules, error: errors?.modules ?? null }),
      );
  }

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should set loading during data fetch', async () => {
    mockResponses([], [], [], [], [], []);
    const promise = service.loadOverview();
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('should query all 6 tables', async () => {
    mockResponses([], [], [], [], [], []);
    await service.loadOverview();

    expect(supabase.client.from).toHaveBeenCalledWith('courses');
    expect(supabase.client.from).toHaveBeenCalledWith('course_enrollments');
    expect(supabase.client.from).toHaveBeenCalledWith('exam_submissions');
    expect(supabase.client.from).toHaveBeenCalledWith('expert_questions');
    expect(supabase.client.from).toHaveBeenCalledWith('issues');
    expect(supabase.client.from).toHaveBeenCalledWith('modules');
  });

  it('should compute per-course counts correctly', async () => {
    mockResponses(
      [
        { id: 'c1', title: 'Course A', staleness_threshold_days: 90 },
        { id: 'c2', title: 'Course B', staleness_threshold_days: 180 },
      ],
      [{ course_id: 'c1' }, { course_id: 'c1' }, { course_id: 'c2' }],
      [{ course_id: 'c1' }],
      [{ course_id: 'c1' }, { course_id: 'c2' }],
      [{ course_id: 'c2' }],
      [
        { course_id: 'c1', updated_at: daysAgo(10), staleness_postponed_until: null },
        { course_id: 'c2', updated_at: daysAgo(10), staleness_postponed_until: null },
      ],
    );

    await service.loadOverview();

    const courses = service.courses();
    expect(courses.length).toBe(2);

    const c1 = courses.find(c => c.id === 'c1')!;
    expect(c1.enrolledCount).toBe(2);
    expect(c1.pendingExams).toBe(1);
    expect(c1.pendingQuestions).toBe(1);
    expect(c1.openIssues).toBe(0);
    expect(c1.totalModules).toBe(1);
    expect(c1.staleModules).toBe(0);

    const c2 = courses.find(c => c.id === 'c2')!;
    expect(c2.enrolledCount).toBe(1);
    expect(c2.pendingExams).toBe(0); // c2 not in canGrade list
    expect(c2.pendingQuestions).toBe(1);
    expect(c2.openIssues).toBe(1);
  });

  it('should set canEdit and canGrade from auth claims', async () => {
    mockResponses(
      [
        { id: 'c1', title: 'Can Edit+Grade', staleness_threshold_days: 180 },
        { id: 'c2', title: 'Read Only', staleness_threshold_days: 180 },
      ],
      [], [], [], [], [],
    );

    await service.loadOverview();

    const c1 = service.courses().find(c => c.id === 'c1')!;
    expect(c1.canEdit).toBe(true);
    expect(c1.canGrade).toBe(true);

    const c2 = service.courses().find(c => c.id === 'c2')!;
    expect(c2.canEdit).toBe(false);
    expect(c2.canGrade).toBe(false);
  });

  it('should exclude pending exams from totalActionItems for non-gradable courses', async () => {
    mockResponses(
      [{ id: 'c2', title: 'No Grade', staleness_threshold_days: 180 }],
      [],
      [{ course_id: 'c2' }, { course_id: 'c2' }], // 2 pending exams for c2
      [],
      [],
      [],
    );

    await service.loadOverview();

    const c2 = service.courses()[0];
    expect(c2.canGrade).toBe(false);
    expect(c2.pendingExams).toBe(0);
    expect(c2.totalActionItems).toBe(0);
  });

  it('should compute staleness correctly', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [],
      [],
      [],
      [],
      [
        { course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: null },
        { course_id: 'c1', updated_at: daysAgo(50), staleness_postponed_until: null },
        { course_id: 'c1', updated_at: daysAgo(200), staleness_postponed_until: null },
      ],
    );

    await service.loadOverview();

    const c1 = service.courses()[0];
    expect(c1.totalModules).toBe(3);
    expect(c1.staleModules).toBe(2); // 120 > 90 and 200 > 90
  });

  it('should respect postponed modules (not counted as stale)', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [],
      [],
      [],
      [],
      [
        { course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: daysFromNow(15) },
        { course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: null },
      ],
    );

    await service.loadOverview();

    const c1 = service.courses()[0];
    expect(c1.staleModules).toBe(1); // Only the non-postponed one
  });

  it('should treat expired postpone as stale', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [],
      [],
      [],
      [],
      [
        { course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: daysAgo(5) },
      ],
    );

    await service.loadOverview();

    expect(service.courses()[0].staleModules).toBe(1);
  });

  it('should default staleness threshold to 180 when null', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: null }],
      [],
      [],
      [],
      [],
      [
        { course_id: 'c1', updated_at: daysAgo(200), staleness_postponed_until: null },
        { course_id: 'c1', updated_at: daysAgo(100), staleness_postponed_until: null },
      ],
    );

    await service.loadOverview();

    const c1 = service.courses()[0];
    expect(c1.staleModules).toBe(1); // only 200 > 180
  });

  it('should sort courses by totalActionItems desc then title asc', async () => {
    mockResponses(
      [
        { id: 'c1', title: 'Zebra', staleness_threshold_days: 180 },
        { id: 'c2', title: 'Alpha', staleness_threshold_days: 180 },
        { id: 'c3', title: 'Beta', staleness_threshold_days: 180 },
      ],
      [],
      [],
      [{ course_id: 'c3' }, { course_id: 'c3' }],
      [{ course_id: 'c1' }],
      [],
    );

    // Update auth to include c3 and c1 grading
    auth = createMockAuthService({
      isAuthenticated: true,
      roles: ['lecturer'],
      claims: {
        lecturer_course_ids: ['c1', 'c2', 'c3'],
        lecturer_can_edit_course_ids: [],
        lecturer_can_grade_course_ids: [],
      },
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TeachingOverviewService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: auth },
      ],
    });
    service = TestBed.inject(TeachingOverviewService);

    await service.loadOverview();

    const titles = service.courses().map(c => c.title);
    // Beta has 2 questions (most items), Zebra has 1 issue, Alpha has 0
    expect(titles).toEqual(['Beta', 'Zebra', 'Alpha']);
  });

  it('should compute totalActionItems as sum of all counts', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [],
      [{ course_id: 'c1' }],
      [{ course_id: 'c1' }, { course_id: 'c1' }],
      [{ course_id: 'c1' }],
      [
        { course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: null },
      ],
    );

    await service.loadOverview();

    const c1 = service.courses()[0];
    // pendingExams=1 (canGrade) + pendingQuestions=2 + openIssues=1 + staleModules=1 = 5
    expect(c1.totalActionItems).toBe(5);
  });

  it('should set error when any query fails', async () => {
    mockResponses([], [], [], [], [], [], { courses: { message: 'Permission denied' } });

    await service.loadOverview();

    expect(service.error()).toBe('Permission denied');
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should handle empty course list', async () => {
    mockResponses([], [], [], [], [], []);

    await service.loadOverview();

    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should grant canEdit and canGrade for all courses when platform admin', async () => {
    const paAuth = createMockAuthService({
      isAuthenticated: true,
      roles: ['platform_admin'],
      claims: {
        is_platform_admin: true,
        lecturer_course_ids: [],
        lecturer_can_edit_course_ids: [],
        lecturer_can_grade_course_ids: [],
      },
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TeachingOverviewService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: paAuth },
      ],
    });
    const paService = TestBed.inject(TeachingOverviewService);

    mockResponses(
      [
        { id: 'c1', title: 'Course A', staleness_threshold_days: 180 },
        { id: 'c2', title: 'Course B', staleness_threshold_days: 180 },
      ],
      [],
      [{ course_id: 'c1' }], // 1 pending exam
      [],
      [],
      [],
    );

    await paService.loadOverview();

    const c1 = paService.courses().find(c => c.id === 'c1')!;
    expect(c1.canEdit).toBe(true);
    expect(c1.canGrade).toBe(true);
    expect(c1.pendingExams).toBe(1); // PA can grade, so exams count

    const c2 = paService.courses().find(c => c.id === 'c2')!;
    expect(c2.canEdit).toBe(true);
    expect(c2.canGrade).toBe(true);
  });

  it('should handle courses with no associated data', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Lonely Course', staleness_threshold_days: 180 }],
      [],
      [],
      [],
      [],
      [],
    );

    await service.loadOverview();

    const c1 = service.courses()[0];
    expect(c1.enrolledCount).toBe(0);
    expect(c1.pendingExams).toBe(0);
    expect(c1.pendingQuestions).toBe(0);
    expect(c1.openIssues).toBe(0);
    expect(c1.staleModules).toBe(0);
    expect(c1.totalModules).toBe(0);
    expect(c1.totalActionItems).toBe(0);
  });
});
