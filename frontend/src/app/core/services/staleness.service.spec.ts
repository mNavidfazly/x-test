import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { StalenessService } from './staleness.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

describe('StalenessService', () => {
  let service: StalenessService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        StalenessService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(StalenessService);
  });

  function mockResponses(courses: unknown[], modules: unknown[], courseError?: unknown, moduleError?: unknown) {
    supabase._mockQueryBuilder.then
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: courses, error: courseError ?? null }),
      )
      .mockImplementationOnce((resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: modules, error: moduleError ?? null }),
      );
  }

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should compute per-module staleness correctly', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Old Course', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Module A', module_type: 'video', course_id: 'c1', updated_at: daysAgo(120) },
        { id: 'm2', title: 'Module B', module_type: 'pdf', course_id: 'c1', updated_at: daysAgo(50) },
      ],
    );

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.id).toBe('c1');
    expect(course.title).toBe('Old Course');
    expect(course.thresholdDays).toBe(90);
    expect(course.totalModuleCount).toBe(2);
    expect(course.hasStaleModules).toBe(true);
    expect(course.staleModuleCount).toBe(1);
    expect(course.freshModuleCount).toBe(1);

    // Stale module sorted first
    const staleModule = course.modules[0];
    expect(staleModule.id).toBe('m1');
    expect(staleModule.title).toBe('Module A');
    expect(staleModule.moduleType).toBe('video');
    expect(staleModule.daysSinceUpdate).toBe(120);
    expect(staleModule.isStale).toBe(true);
    expect(staleModule.daysOverdue).toBe(30);

    // Fresh module second
    const freshModule = course.modules[1];
    expect(freshModule.id).toBe('m2');
    expect(freshModule.daysSinceUpdate).toBe(50);
    expect(freshModule.isStale).toBe(false);
    expect(freshModule.daysOverdue).toBeNull();
  });

  it('should identify all-fresh courses', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Fresh Course', staleness_threshold_days: 180 }],
      [
        { id: 'm1', title: 'Mod', module_type: 'markdown', course_id: 'c1', updated_at: daysAgo(30) },
      ],
    );

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.hasStaleModules).toBe(false);
    expect(course.staleModuleCount).toBe(0);
    expect(course.freshModuleCount).toBe(1);
    expect(course.modules[0].isStale).toBe(false);
  });

  it('should handle courses with no modules', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Empty Course', staleness_threshold_days: 90 }],
      [],
    );

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.totalModuleCount).toBe(0);
    expect(course.modules).toEqual([]);
    expect(course.hasStaleModules).toBe(false);
    expect(course.staleModuleCount).toBe(0);
    expect(course.freshModuleCount).toBe(0);
  });

  it('should default to 180 days when staleness_threshold_days is null', async () => {
    mockResponses(
      [{ id: 'c1', title: 'No Threshold', staleness_threshold_days: null }],
      [
        { id: 'm1', title: 'Old Mod', module_type: 'video', course_id: 'c1', updated_at: daysAgo(200) },
      ],
    );

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.thresholdDays).toBe(180);
    expect(course.modules[0].isStale).toBe(true);
    expect(course.modules[0].daysOverdue).toBe(20);
  });

  it('should compute mixed course with stale and fresh modules', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Mixed', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Stale A', module_type: 'video', course_id: 'c1', updated_at: daysAgo(200) },
        { id: 'm2', title: 'Stale B', module_type: 'pdf', course_id: 'c1', updated_at: daysAgo(150) },
        { id: 'm3', title: 'Fresh', module_type: 'quiz', course_id: 'c1', updated_at: daysAgo(10) },
      ],
    );

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.staleModuleCount).toBe(2);
    expect(course.freshModuleCount).toBe(1);
    expect(course.hasStaleModules).toBe(true);
  });

  it('should sort modules within a course: stale first by daysOverdue desc', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Fresh', module_type: 'video', course_id: 'c1', updated_at: daysAgo(10) },
        { id: 'm2', title: 'Very Stale', module_type: 'pdf', course_id: 'c1', updated_at: daysAgo(300) },
        { id: 'm3', title: 'Slightly Stale', module_type: 'quiz', course_id: 'c1', updated_at: daysAgo(100) },
      ],
    );

    await service.loadStalenessData();

    const titles = service.courses()[0].modules.map(m => m.title);
    expect(titles).toEqual(['Very Stale', 'Slightly Stale', 'Fresh']);
  });

  it('should sort courses: has stale first, then all-fresh, then no-modules', async () => {
    mockResponses(
      [
        { id: 'c1', title: 'All Fresh', staleness_threshold_days: 180 },
        { id: 'c2', title: 'Has Stale', staleness_threshold_days: 90 },
        { id: 'c3', title: 'No Modules', staleness_threshold_days: 180 },
      ],
      [
        { id: 'm1', title: 'Mod', module_type: 'video', course_id: 'c1', updated_at: daysAgo(10) },
        { id: 'm2', title: 'Old Mod', module_type: 'pdf', course_id: 'c2', updated_at: daysAgo(200) },
      ],
    );

    await service.loadStalenessData();

    expect(service.courses()[0].title).toBe('Has Stale');
    expect(service.courses()[1].title).toBe('All Fresh');
    expect(service.courses()[2].title).toBe('No Modules');
  });

  it('should preserve module fields', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 180 }],
      [
        { id: 'mod-uuid', title: 'Quiz Module', module_type: 'quiz', course_id: 'c1', updated_at: daysAgo(5) },
      ],
    );

    await service.loadStalenessData();

    const mod = service.courses()[0].modules[0];
    expect(mod.id).toBe('mod-uuid');
    expect(mod.title).toBe('Quiz Module');
    expect(mod.moduleType).toBe('quiz');
    expect(mod.updatedAt).toBeTruthy();
  });

  it('should set error when courses query fails', async () => {
    mockResponses([], [], { message: 'Permission denied' });

    await service.loadStalenessData();

    expect(service.error()).toBe('Permission denied');
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should set error when modules query fails', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 180 }],
      [],
      null,
      { message: 'Module query failed' },
    );

    await service.loadStalenessData();

    expect(service.error()).toBe('Module query failed');
    expect(service.loading()).toBe(false);
  });

  it('should query correct tables', async () => {
    mockResponses([], []);

    await service.loadStalenessData();

    expect(supabase.client.from).toHaveBeenCalledWith('courses');
    expect(supabase.client.from).toHaveBeenCalledWith('modules');
  });

  it('should handle empty course list', async () => {
    mockResponses([], []);

    await service.loadStalenessData();

    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should set loading during data fetch', async () => {
    mockResponses([], []);

    const promise = service.loadStalenessData();
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  // --- Postpone tests ---

  const daysFromNow = (n: number) => new Date(now + n * 86_400_000).toISOString();

  it('should mark module with future postponedUntil as postponed, not stale', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Postponed Mod', module_type: 'video', course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: daysFromNow(15) },
      ],
    );

    await service.loadStalenessData();

    const mod = service.courses()[0].modules[0];
    expect(mod.isPostponed).toBe(true);
    expect(mod.isStale).toBe(false);
    expect(mod.daysOverdue).toBe(30); // still past threshold
    expect(mod.postponedUntil).toBeTruthy();
  });

  it('should mark module with expired postponedUntil as stale', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Expired Postpone', module_type: 'video', course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: daysAgo(5) },
      ],
    );

    await service.loadStalenessData();

    const mod = service.courses()[0].modules[0];
    expect(mod.isPostponed).toBe(false);
    expect(mod.isStale).toBe(true);
  });

  it('should treat null postponedUntil as not postponed', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'No Postpone', module_type: 'video', course_id: 'c1', updated_at: daysAgo(120), staleness_postponed_until: null },
      ],
    );

    await service.loadStalenessData();

    const mod = service.courses()[0].modules[0];
    expect(mod.isPostponed).toBe(false);
    expect(mod.isStale).toBe(true);
  });

  it('should compute postponedModuleCount and exclude from freshModuleCount', async () => {
    mockResponses(
      [{ id: 'c1', title: 'Mixed', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Stale', module_type: 'video', course_id: 'c1', updated_at: daysAgo(200), staleness_postponed_until: null },
        { id: 'm2', title: 'Postponed', module_type: 'pdf', course_id: 'c1', updated_at: daysAgo(150), staleness_postponed_until: daysFromNow(20) },
        { id: 'm3', title: 'Fresh', module_type: 'quiz', course_id: 'c1', updated_at: daysAgo(10), staleness_postponed_until: null },
      ],
    );

    await service.loadStalenessData();

    const course = service.courses()[0];
    expect(course.staleModuleCount).toBe(1);
    expect(course.postponedModuleCount).toBe(1);
    expect(course.freshModuleCount).toBe(1); // 3 total - 1 stale - 1 postponed
    expect(course.hasStaleModules).toBe(true);
  });

  it('should call update for postponeModule', async () => {
    supabase._mockQueryBuilder.then.mockImplementationOnce(
      (resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: null, error: null }),
    );

    await service.postponeModule('mod-123');

    expect(supabase.client.from).toHaveBeenCalledWith('modules');
  });

  it('should call update with .in() for postponeAllStaleModules', async () => {
    // First load courses so service has data
    mockResponses(
      [{ id: 'c1', title: 'Course', staleness_threshold_days: 90 }],
      [
        { id: 'm1', title: 'Stale A', module_type: 'video', course_id: 'c1', updated_at: daysAgo(200), staleness_postponed_until: null },
        { id: 'm2', title: 'Fresh', module_type: 'pdf', course_id: 'c1', updated_at: daysAgo(10), staleness_postponed_until: null },
      ],
    );
    await service.loadStalenessData();

    // Mock the update call
    supabase._mockQueryBuilder.then.mockImplementationOnce(
      (resolve: (v: { data: unknown; error: unknown }) => void) =>
        resolve({ data: null, error: null }),
    );

    await service.postponeAllStaleModules('c1');

    // Verify it called from('modules')
    expect(supabase.client.from).toHaveBeenCalledWith('modules');
  });
});
