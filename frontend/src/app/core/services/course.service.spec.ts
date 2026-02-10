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

  describe('loadModuleViewer', () => {
    const preloadCourseDetail = async () => {
      const courseData = {
        id: 'c1', title: 'Course', description: null, thumbnail_url: null, enrollment_type: 'open',
        lectures: [{
          id: 'l1', title: 'Lecture 1', description: null, sort_order: 0,
          modules: [
            { id: 'mod-1', title: 'Video Mod', module_type: 'video', sort_order: 0 },
            { id: 'mod-2', title: 'PDF Mod', module_type: 'pdf', sort_order: 1 },
          ],
        }],
      };
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({ data: courseData, error: null });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      await service.loadCourseDetail('c1');
    };

    it('should load video module viewer data', async () => {
      await preloadCourseDetail();

      // loadModuleViewer: single (module) → single (video content), then (files), maybeSingle (progress)
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-1', title: 'Video Mod', description: 'A video', module_type: 'video', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { video_url: 'https://cdn/video.mp4', thumbnail_url: null, duration: 120 },
          error: null,
        });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await service.loadModuleViewer('c1', 'mod-1');

      const viewer = service.moduleViewer();
      expect(viewer).not.toBeNull();
      expect(viewer!.module.id).toBe('mod-1');
      expect(viewer!.module.description).toBe('A video');
      expect(viewer!.content.type).toBe('video');
      if (viewer!.content.type === 'video') {
        expect(viewer!.content.data.video_url).toBe('https://cdn/video.mp4');
      }
      expect(viewer!.navigation.prev).toBeNull();
      expect(viewer!.navigation.next).not.toBeNull();
      expect(viewer!.navigation.next!.id).toBe('mod-2');
      expect(viewer!.navigation.current).toBe(1);
      expect(viewer!.navigation.total).toBe(2);
    });

    it('should load progress when module has been completed', async () => {
      await preloadCourseDetail();

      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-1', title: 'Video Mod', description: null, module_type: 'video', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { video_url: 'https://cdn/v.mp4', thumbnail_url: null, duration: 60 },
          error: null,
        });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
        data: { status: 'completed', completed_at: '2026-02-01T10:00:00Z' },
        error: null,
      });

      await service.loadModuleViewer('c1', 'mod-1');

      expect(service.moduleViewer()!.progress).toEqual({ status: 'completed', completed_at: '2026-02-01T10:00:00Z' });
    });

    it('should handle module load error', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Module not found' },
      });

      await service.loadModuleViewer('c1', 'bad-id');

      expect(service.error()).toBe('Module not found');
      expect(service.moduleViewer()).toBeNull();
      expect(service.loading()).toBe(false);
    });

    it('should error when not authenticated', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          CourseService,
          { provide: SupabaseService, useValue: supabase },
          { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: false }) },
        ],
      });
      const unauthService = TestBed.inject(CourseService);

      await unauthService.loadModuleViewer('c1', 'mod-1');

      expect(unauthService.error()).toBe('Not authenticated');
      expect(unauthService.moduleViewer()).toBeNull();
    });
  });

  describe('markModuleComplete', () => {
    const setupViewer = async () => {
      // Load course detail first
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'c1', title: 'C', description: null, thumbnail_url: null, enrollment_type: 'open', lectures: [{ id: 'l1', title: 'L1', description: null, sort_order: 0, modules: [{ id: 'mod-1', title: 'M1', module_type: 'video', sort_order: 0 }] }] },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      await service.loadCourseDetail('c1');

      // Load module viewer
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({ data: { id: 'mod-1', title: 'M1', description: null, module_type: 'video', sort_order: 0, lecture_id: 'l1', course_id: 'c1' }, error: null })
        .mockResolvedValueOnce({ data: { video_url: 'v.mp4', thumbnail_url: null, duration: 60 }, error: null });
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await service.loadModuleViewer('c1', 'mod-1');
    };

    it('should upsert progress and update local state', async () => {
      await setupViewer();
      expect(service.moduleViewer()!.progress).toBeNull();

      // upsert resolves via the mock chain (upsert returns mockQueryBuilder, then .then is called)
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.markModuleComplete('mod-1');

      expect(service.moduleViewer()!.progress).not.toBeNull();
      expect(service.moduleViewer()!.progress!.status).toBe('completed');
    });

    it('should handle upsert error', async () => {
      await setupViewer();

      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Permission denied' } }));

      await service.markModuleComplete('mod-1');

      expect(service.error()).toBe('Permission denied');
      expect(service.moduleViewer()!.progress).toBeNull();
    });
  });

  describe('createCourse', () => {
    it('should insert course and return id', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'new-id' },
        error: null,
      });

      const result = await service.createCourse({
        title: 'New Course',
        description: 'Desc',
        thumbnail_url: null,
        enrollment_type: 'open',
        password_hash: null,
        staleness_threshold_days: null,
      });

      expect(result).toEqual({ id: 'new-id' });
      expect(supabase.client.from).toHaveBeenCalledWith('courses');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(service.createCourse({
        title: 'Test',
        description: null,
        thumbnail_url: null,
        enrollment_type: 'open',
        password_hash: null,
        staleness_threshold_days: null,
      })).rejects.toThrow('RLS violation');
    });
  });

  describe('updateCourse', () => {
    it('should update course by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateCourse('c1', { title: 'Updated' });

      expect(supabase.client.from).toHaveBeenCalledWith('courses');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ title: 'Updated' });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('should throw on update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Permission denied' } }));

      await expect(service.updateCourse('c1', { title: 'X' })).rejects.toThrow('Permission denied');
    });
  });

  describe('deleteCourse', () => {
    it('should delete course by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.deleteCourse('c1');

      expect(supabase.client.from).toHaveBeenCalledWith('courses');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'c1');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Cannot delete' } }));

      await expect(service.deleteCourse('c1')).rejects.toThrow('Cannot delete');
    });
  });

  describe('loadTenants', () => {
    it('should load and return tenant list', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({
          data: [
            { id: 't1', name: 'Alpha', domain: 'alpha.com', is_master: false },
            { id: 't2', name: 'Calypso', domain: 'calypso-commodities.com', is_master: true },
          ],
          error: null,
        }));

      const tenants = await service.loadTenants();

      expect(tenants).toHaveLength(2);
      expect(tenants[0].name).toBe('Alpha');
      expect(tenants[1].is_master).toBe(true);
      expect(supabase.client.from).toHaveBeenCalledWith('tenants');
    });

    it('should throw on load error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'No access' } }));

      await expect(service.loadTenants()).rejects.toThrow('No access');
    });
  });

  describe('tenant assignment methods', () => {
    it('should load tenant assignments for a course', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({
          data: [
            { tenant_id: 't1', tenants: { name: 'Alpha Corp' } },
            { tenant_id: 't2', tenants: { name: 'Beta Inc' } },
          ],
          error: null,
        }));

      const assignments = await service.loadTenantAssignments('c1');

      expect(assignments).toHaveLength(2);
      expect(assignments[0]).toEqual({ tenant_id: 't1', tenant_name: 'Alpha Corp' });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('course_id', 'c1');
    });

    it('should assign course to tenant', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.assignCourseToTenant('c1', 't1');

      expect(supabase.client.from).toHaveBeenCalledWith('tenant_courses');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({ course_id: 'c1', tenant_id: 't1' });
    });

    it('should remove course from tenant', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.removeCourseFromTenant('c1', 't1');

      expect(supabase.client.from).toHaveBeenCalledWith('tenant_courses');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
    });
  });

  describe('createLecture', () => {
    it('should insert lecture with calculated sort_order and return id', async () => {
      // Preload courseDetail with 2 lectures (sort_order 0 and 1)
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'c1', title: 'C', description: null, thumbnail_url: null, enrollment_type: 'open',
          lectures: [
            { id: 'l1', title: 'L1', description: null, sort_order: 0, modules: [] },
            { id: 'l2', title: 'L2', description: null, sort_order: 1, modules: [] },
          ],
        },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      await service.loadCourseDetail('c1');

      // Now createLecture
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'new-lecture-id' },
        error: null,
      });

      const result = await service.createLecture('c1', { title: 'New Lecture', description: 'Desc' });

      expect(result).toEqual({ id: 'new-lecture-id' });
      expect(supabase.client.from).toHaveBeenCalledWith('lectures');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        course_id: 'c1',
        title: 'New Lecture',
        description: 'Desc',
        sort_order: 2,
      });
    });

    it('should use sort_order 0 when no lectures exist', async () => {
      // Preload courseDetail with 0 lectures
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'c1', title: 'C', description: null, thumbnail_url: null, enrollment_type: 'open',
          lectures: [],
        },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      await service.loadCourseDetail('c1');

      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'first-lecture' },
        error: null,
      });

      const result = await service.createLecture('c1', { title: 'First', description: null });

      expect(result).toEqual({ id: 'first-lecture' });
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        course_id: 'c1',
        title: 'First',
        description: null,
        sort_order: 0,
      });
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(service.createLecture('c1', { title: 'X', description: null })).rejects.toThrow('RLS violation');
    });
  });

  describe('updateLecture', () => {
    it('should update lecture by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateLecture('l1', { title: 'Updated Title' });

      expect(supabase.client.from).toHaveBeenCalledWith('lectures');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ title: 'Updated Title' });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    });

    it('should throw on update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Permission denied' } }));

      await expect(service.updateLecture('l1', { title: 'X' })).rejects.toThrow('Permission denied');
    });
  });

  describe('deleteLecture', () => {
    it('should delete lecture by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.deleteLecture('l1');

      expect(supabase.client.from).toHaveBeenCalledWith('lectures');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'l1');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Cannot delete' } }));

      await expect(service.deleteLecture('l1')).rejects.toThrow('Cannot delete');
    });
  });

  describe('swapLectureSortOrder', () => {
    it('should swap sort_order of two lectures sequentially', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.swapLectureSortOrder('l1', 0, 'l2', 1);

      expect(supabase.client.from).toHaveBeenCalledWith('lectures');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ sort_order: 1 });
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ sort_order: 0 });
    });

    it('should throw on first update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Reorder failed' } }));

      await expect(service.swapLectureSortOrder('l1', 0, 'l2', 1)).rejects.toThrow('Reorder failed');
    });
  });
});
