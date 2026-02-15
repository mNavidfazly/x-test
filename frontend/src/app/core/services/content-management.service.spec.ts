import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ContentManagementService } from './content-management.service';
import { SupabaseService } from './supabase.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';

describe('ContentManagementService', () => {
  let service: ContentManagementService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ContentManagementService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(ContentManagementService);
  });

  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86_400_000).toISOString();
  const daysFromNow = (n: number) => new Date(now + n * 86_400_000).toISOString();

  function mockCourses(courses: unknown[], error?: unknown) {
    supabase._mockQueryResponse(courses, error ?? null);
  }

  function makeCourse(overrides: Record<string, unknown> = {}) {
    return {
      id: 'c1',
      title: 'Test Course',
      description: null,
      thumbnail_url: null,
      enrollment_type: 'open',
      staleness_threshold_days: 180,
      updated_at: daysAgo(10),
      lectures: [],
      tenant_courses: [{ count: 0 }],
      ...overrides,
    };
  }

  function makeModule(overrides: Record<string, unknown> = {}) {
    return {
      id: 'm1',
      title: 'Module A',
      module_type: 'video',
      sort_order: 0,
      updated_at: daysAgo(10),
      staleness_postponed_until: null,
      ...overrides,
    };
  }

  function makeLecture(overrides: Record<string, unknown> = {}) {
    return {
      id: 'l1',
      title: 'Lecture 1',
      sort_order: 0,
      modules: [],
      ...overrides,
    };
  }

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  it('should load courses with nested lectures and modules', async () => {
    mockCourses([
      makeCourse({
        lectures: [
          makeLecture({
            modules: [makeModule()],
          }),
        ],
        tenant_courses: [{ count: 2 }],
      }),
    ]);

    await service.loadContentOverview();

    expect(service.courses().length).toBe(1);
    const course = service.courses()[0];
    expect(course.id).toBe('c1');
    expect(course.title).toBe('Test Course');
    expect(course.lectureCount).toBe(1);
    expect(course.totalModules).toBe(1);
    expect(course.tenantCount).toBe(2);
  });

  it('should compute per-module staleness correctly', async () => {
    mockCourses([
      makeCourse({
        staleness_threshold_days: 90,
        lectures: [
          makeLecture({
            modules: [
              makeModule({ id: 'm1', updated_at: daysAgo(120) }),
              makeModule({ id: 'm2', title: 'Fresh Mod', updated_at: daysAgo(50) }),
            ],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    const course = service.courses()[0];
    expect(course.staleModuleCount).toBe(1);
    expect(course.hasStaleModules).toBe(true);

    const stale = course.lectures[0].modules[0];
    expect(stale.daysSinceUpdate).toBe(120);
    expect(stale.isStale).toBe(true);
    expect(stale.isPostponed).toBe(false);

    const fresh = course.lectures[0].modules[1];
    expect(fresh.daysSinceUpdate).toBe(50);
    expect(fresh.isStale).toBe(false);
  });

  it('should mark module with future postponedUntil as postponed, not stale', async () => {
    mockCourses([
      makeCourse({
        staleness_threshold_days: 90,
        lectures: [
          makeLecture({
            modules: [
              makeModule({
                updated_at: daysAgo(120),
                staleness_postponed_until: daysFromNow(15),
              }),
            ],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    const mod = service.courses()[0].lectures[0].modules[0];
    expect(mod.isPostponed).toBe(true);
    expect(mod.isStale).toBe(false);
    expect(mod.postponedUntil).toBeTruthy();
  });

  it('should mark module with expired postponedUntil as stale', async () => {
    mockCourses([
      makeCourse({
        staleness_threshold_days: 90,
        lectures: [
          makeLecture({
            modules: [
              makeModule({
                updated_at: daysAgo(120),
                staleness_postponed_until: daysAgo(5),
              }),
            ],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    const mod = service.courses()[0].lectures[0].modules[0];
    expect(mod.isPostponed).toBe(false);
    expect(mod.isStale).toBe(true);
  });

  it('should compute modulesByType breakdown', async () => {
    mockCourses([
      makeCourse({
        lectures: [
          makeLecture({
            modules: [
              makeModule({ id: 'm1', module_type: 'video' }),
              makeModule({ id: 'm2', module_type: 'video' }),
              makeModule({ id: 'm3', module_type: 'pdf' }),
              makeModule({ id: 'm4', module_type: 'quiz' }),
            ],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    const course = service.courses()[0];
    expect(course.modulesByType).toEqual({ video: 2, pdf: 1, quiz: 1 });
    expect(course.totalModules).toBe(4);
  });

  it('should compute tenantCount from nested count', async () => {
    mockCourses([
      makeCourse({ tenant_courses: [{ count: 5 }] }),
    ]);

    await service.loadContentOverview();

    expect(service.courses()[0].tenantCount).toBe(5);
  });

  it('should default tenantCount to 0 when tenant_courses is empty', async () => {
    mockCourses([
      makeCourse({ tenant_courses: [] }),
    ]);

    await service.loadContentOverview();

    expect(service.courses()[0].tenantCount).toBe(0);
  });

  it('should compute lastModuleUpdate as max updated_at', async () => {
    const oldest = daysAgo(100);
    const newest = daysAgo(5);
    const middle = daysAgo(50);

    mockCourses([
      makeCourse({
        lectures: [
          makeLecture({
            modules: [
              makeModule({ id: 'm1', updated_at: oldest }),
              makeModule({ id: 'm2', updated_at: newest }),
              makeModule({ id: 'm3', updated_at: middle }),
            ],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    expect(service.courses()[0].lastModuleUpdate).toBe(newest);
  });

  it('should handle courses with no lectures', async () => {
    mockCourses([makeCourse({ lectures: [] })]);

    await service.loadContentOverview();

    const course = service.courses()[0];
    expect(course.lectureCount).toBe(0);
    expect(course.totalModules).toBe(0);
    expect(course.hasStaleModules).toBe(false);
    expect(course.lastModuleUpdate).toBeNull();
  });

  it('should handle courses with lectures but no modules', async () => {
    mockCourses([
      makeCourse({
        lectures: [makeLecture({ modules: [] })],
      }),
    ]);

    await service.loadContentOverview();

    const course = service.courses()[0];
    expect(course.lectureCount).toBe(1);
    expect(course.totalModules).toBe(0);
  });

  it('should default threshold to 180 when staleness_threshold_days is null', async () => {
    mockCourses([
      makeCourse({
        staleness_threshold_days: null,
        lectures: [
          makeLecture({
            modules: [makeModule({ updated_at: daysAgo(200) })],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    const course = service.courses()[0];
    expect(course.staleness_threshold_days).toBe(180);
    expect(course.lectures[0].modules[0].isStale).toBe(true);
  });

  it('should set loading during fetch', async () => {
    mockCourses([]);
    const promise = service.loadContentOverview();
    expect(service.loading()).toBe(true);
    await promise;
    expect(service.loading()).toBe(false);
  });

  it('should set error on query failure', async () => {
    mockCourses(null, { message: 'Permission denied' });

    await service.loadContentOverview();

    expect(service.error()).toBe('Permission denied');
    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
  });

  it('should compute freshModuleCount excluding stale and postponed', async () => {
    mockCourses([
      makeCourse({
        staleness_threshold_days: 90,
        lectures: [
          makeLecture({
            modules: [
              makeModule({ id: 'm1', updated_at: daysAgo(200) }),
              makeModule({ id: 'm2', updated_at: daysAgo(150), staleness_postponed_until: daysFromNow(20) }),
              makeModule({ id: 'm3', updated_at: daysAgo(10) }),
            ],
          }),
        ],
      }),
    ]);

    await service.loadContentOverview();

    const course = service.courses()[0];
    expect(course.staleModuleCount).toBe(1);
    expect(course.postponedModuleCount).toBe(1);
    expect(course.freshModuleCount).toBe(1);
  });

  it('should query courses table', async () => {
    mockCourses([]);

    await service.loadContentOverview();

    expect(supabase.client.from).toHaveBeenCalledWith('courses');
  });

  it('should handle empty course list', async () => {
    mockCourses([]);

    await service.loadContentOverview();

    expect(service.courses()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });
});
