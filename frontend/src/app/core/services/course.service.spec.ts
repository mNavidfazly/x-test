import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { CourseService } from './course.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { createMockSupabaseService } from '../../__mocks__/supabase.mock';
import { createMockAuthService } from '../../__mocks__/auth.mock';

describe('CourseService', () => {
  let service: CourseService;
  let supabase: ReturnType<typeof createMockSupabaseService>;

  beforeEach(() => {
    supabase = createMockSupabaseService();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        CourseService,
        { provide: SupabaseService, useValue: supabase },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, userId: 'test-user-id' }) },
      ],
    });
    service = TestBed.inject(CourseService);
  });

  it('should have empty initial state', () => {
    expect(service.courses()).toEqual([]);
    expect(service.courseDetail()).toBeNull();
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
  });

  describe('loadCourses', () => {
    it('should load and merge course data from 4 parallel queries', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        switch (callCount) {
          case 1: // courses
            return resolve({
              data: [
                { id: 'c1', title: 'Course A', description: 'Desc A', thumbnail_url: null, enrollment_type: 'open' },
                { id: 'c2', title: 'Course B', description: null, thumbnail_url: 'thumb.jpg', enrollment_type: 'invite_only' },
              ],
              error: null,
            });
          case 2: // modules
            return resolve({
              data: [
                { id: 'm1', course_id: 'c1' },
                { id: 'm2', course_id: 'c1' },
                { id: 'm3', course_id: 'c2' },
              ],
              error: null,
            });
          case 3: // user_progress
            return resolve({
              data: [
                { module_id: 'm1', course_id: 'c1', status: 'completed', updated_at: '2026-01-15T10:00:00Z' },
                { module_id: 'm2', course_id: 'c1', status: 'in_progress', updated_at: '2026-01-20T12:00:00Z' },
              ],
              error: null,
            });
          case 4: // enrollments
            return resolve({
              data: [{ course_id: 'c1' }],
              error: null,
            });
          default:
            return resolve({ data: [], error: null });
        }
      });

      await service.loadCourses();

      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');

      const courses = service.courses();
      expect(courses).toHaveLength(2);

      expect(courses[0]).toEqual({
        id: 'c1',
        title: 'Course A',
        description: 'Desc A',
        thumbnail_url: null,
        enrollment_type: 'open',
        moduleCount: 2,
        completedModules: 1,
        progressPercent: 50,
        isEnrolled: true,
        lastActivity: '2026-01-20T12:00:00Z',
      });

      expect(courses[1]).toEqual({
        id: 'c2',
        title: 'Course B',
        description: null,
        thumbnail_url: 'thumb.jpg',
        enrollment_type: 'invite_only',
        moduleCount: 1,
        completedModules: 0,
        progressPercent: 0,
        isEnrolled: false,
        lastActivity: null,
      });
    });

    it('should set loading state during fetch', async () => {
      let loadingDuringFetch = false;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        loadingDuringFetch = service.loading();
        return resolve({ data: [], error: null });
      });

      await service.loadCourses();
      expect(loadingDuringFetch).toBe(true);
      expect(service.loading()).toBe(false);
    });

    it('should handle errors gracefully', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) => {
        return resolve({ data: null, error: { message: 'Network error' } });
      });

      await service.loadCourses();

      expect(service.error()).toBe('Network error');
      expect(service.courses()).toEqual([]);
      expect(service.loading()).toBe(false);
    });

    it('should error when user is not authenticated', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          CourseService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: false }) },
        ],
      });
      const unauthService = TestBed.inject(CourseService);

      await unauthService.loadCourses();

      expect(unauthService.error()).toBe('Not authenticated');
      expect(unauthService.courses()).toEqual([]);
    });

    it('should calculate 0% progress when no modules', async () => {
      let callCount = 0;
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        callCount++;
        if (callCount === 1) {
          return resolve({ data: [{ id: 'c1', title: 'Empty', description: null, thumbnail_url: null, enrollment_type: 'open' }], error: null });
        }
        return resolve({ data: [], error: null });
      });

      await service.loadCourses();

      expect(service.courses()[0].progressPercent).toBe(0);
      expect(service.courses()[0].moduleCount).toBe(0);
    });
  });

  describe('loadCourseDetail', () => {
    it('should load course with nested lectures and modules', async () => {
      const courseData = {
        id: 'c1',
        title: 'Course A',
        description: 'Desc',
        thumbnail_url: null,
        enrollment_type: 'open',
        lectures: [
          {
            id: 'l1', title: 'Lecture 1', description: null, sort_order: 0,
            modules: [
              { id: 'm1', title: 'Video Module', module_type: 'video', sort_order: 0 },
              { id: 'm2', title: 'Quiz Module', module_type: 'quiz', sort_order: 1 },
            ],
          },
        ],
      };

      supabase._mockQueryBuilder.single.mockResolvedValue({ data: courseData, error: null });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) => {
        return resolve({
          data: [
            { module_id: 'm1', status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
          ],
          error: null,
        });
      });

      await service.loadCourseDetail('c1');

      expect(service.loading()).toBe(false);
      expect(service.error()).toBe('');

      const detail = service.courseDetail();
      expect(detail).not.toBeNull();
      expect(detail!.id).toBe('c1');
      expect(detail!.lectures).toHaveLength(1);
      expect(detail!.lectures[0].modules).toHaveLength(2);
      expect(detail!.progressMap['m1']).toEqual({ status: 'completed', completed_at: '2026-01-15T10:00:00Z' });
      expect(detail!.progressMap['m2']).toBeUndefined();
    });

    it('should clear previous detail before loading', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValue({
        data: { id: 'c1', title: 'A', description: null, thumbnail_url: null, enrollment_type: 'open', lectures: [] },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) => {
        return resolve({ data: [], error: null });
      });

      await service.loadCourseDetail('c1');
      expect(service.courseDetail()).not.toBeNull();

      // Start new load — should clear immediately
      let detailDuringLoad: unknown = 'not-checked';
      supabase._mockQueryBuilder.single.mockImplementation(async () => {
        detailDuringLoad = service.courseDetail();
        return { data: { id: 'c2', title: 'B', description: null, thumbnail_url: null, enrollment_type: 'open', lectures: [] }, error: null };
      });

      await service.loadCourseDetail('c2');
      expect(detailDuringLoad).toBeNull();
    });

    it('should handle errors in detail loading', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Course not found' },
      });

      await service.loadCourseDetail('bad-id');

      expect(service.error()).toBe('Course not found');
      expect(service.courseDetail()).toBeNull();
      expect(service.loading()).toBe(false);
    });
  });
});
