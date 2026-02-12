import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';
import { CourseService } from './course.service';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { BunnyUploadService } from './bunny-upload.service';
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
        { provide: BunnyUploadService, useValue: { deleteVideo: vi.fn().mockReturnValue(EMPTY) } },
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
          { provide: BunnyUploadService, useValue: { deleteVideo: vi.fn().mockReturnValue(EMPTY) } },
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
          { provide: BunnyUploadService, useValue: { deleteVideo: vi.fn().mockReturnValue(EMPTY) } },
        ],
      });
      const unauthService = TestBed.inject(CourseService);

      await unauthService.loadModuleViewer('c1', 'mod-1');

      expect(unauthService.error()).toBe('Not authenticated');
      expect(unauthService.moduleViewer()).toBeNull();
    });

    it('should filter out module_files whose storage objects are missing', async () => {
      await preloadCourseDetail();

      // module metadata → single
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-1', title: 'Video Mod', description: null, module_type: 'video', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        // video content → single
        .mockResolvedValueOnce({
          data: { video_url: 'https://cdn/video.mp4', thumbnail_url: null, duration: 120 },
          error: null,
        });

      // module_files → two files, one will fail signed URL
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({
          data: [
            { id: 'f1', file_url: 'course-1/good-file.pdf', file_name: 'good-file.pdf', file_size: 1024 },
            { id: 'f2', file_url: 'course-1/deleted-file.pdf', file_name: 'deleted-file.pdf', file_size: 2048 },
          ],
          error: null,
        }));
      supabase._mockQueryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      // Mock createSignedUrl: succeed for first, fail for second
      const storageMock = supabase.client.storage.from('course-files');
      storageMock.createSignedUrl = vi.fn()
        .mockResolvedValueOnce({ data: { signedUrl: 'https://signed/good-file.pdf' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'Object not found' } });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await service.loadModuleViewer('c1', 'mod-1');

      const viewer = service.moduleViewer();
      expect(viewer).not.toBeNull();
      // Only the good file should remain
      expect(viewer!.files).toHaveLength(1);
      expect(viewer!.files[0].file_name).toBe('good-file.pdf');
      expect(viewer!.files[0].file_url).toBe('https://signed/good-file.pdf');

      // Should have warned about the missing file
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('deleted-file.pdf'),
        // any extra args from console.warn
      );
      warnSpy.mockRestore();
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

  describe('createModule', () => {
    const preloadCourseDetail = async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'c1', title: 'C', description: null, thumbnail_url: null, enrollment_type: 'open',
          lectures: [{
            id: 'l1', title: 'L1', description: null, sort_order: 0,
            modules: [
              { id: 'm1', title: 'M1', module_type: 'video', sort_order: 0 },
              { id: 'm2', title: 'M2', module_type: 'pdf', sort_order: 1 },
            ],
          }],
        },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      await service.loadCourseDetail('c1');
    };

    it('should insert module + video content and return id', async () => {
      await preloadCourseDetail();

      // Step 1: insert module → .select('id').single()
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'new-mod-id' },
        error: null,
      });
      // Step 2: insert module_videos → .then()
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      const result = await service.createModule('c1', {
        module: { title: 'New Video', description: 'Desc', module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'https://cdn/v.mp4', thumbnail_url: null, duration: 120 } },
      });

      expect(result).toEqual({ id: 'new-mod-id' });
      expect(supabase.client.from).toHaveBeenCalledWith('modules');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        course_id: 'c1',
        lecture_id: 'l1',
        title: 'New Video',
        description: 'Desc',
        module_type: 'video',
        sort_order: 2,
      });
    });

    it('should calculate sort_order from loaded courseDetail', async () => {
      await preloadCourseDetail();

      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'mod-x' },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.createModule('c1', {
        module: { title: 'Third Module', description: null, module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'v.mp4', thumbnail_url: null, duration: null } },
      });

      // Lecture l1 has modules with sort_order 0 and 1, so next should be 2
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 2 }),
      );
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(service.createModule('c1', {
        module: { title: 'X', description: null, module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'v.mp4', thumbnail_url: null, duration: null } },
      })).rejects.toThrow('RLS violation');
    });

    it('should use sort_order 0 when lecture has no modules', async () => {
      // Preload courseDetail with an empty-module lecture
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'c1', title: 'C', description: null, thumbnail_url: null, enrollment_type: 'open',
          lectures: [{
            id: 'l-empty', title: 'Empty Lecture', description: null, sort_order: 0,
            modules: [],
          }],
        },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown[]; error: null }) => void) =>
        resolve({ data: [], error: null }));
      await service.loadCourseDetail('c1');

      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'first-mod' },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      const result = await service.createModule('c1', {
        module: { title: 'First Module', description: null, module_type: 'video', lecture_id: 'l-empty' },
        content: { type: 'video', data: { video_url: 'v.mp4', thumbnail_url: null, duration: null } },
      });

      expect(result).toEqual({ id: 'first-mod' });
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({ sort_order: 0 }),
      );
    });
  });

  describe('updateModule', () => {
    it('should update module by id', async () => {
      // update modules → .eq('id', ...) resolves via .then()
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateModule('mod-1', {
        module: { title: 'Updated Title', description: 'Updated Desc', module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'https://cdn/new.mp4', thumbnail_url: null, duration: 200 } },
      });

      expect(supabase.client.from).toHaveBeenCalledWith('modules');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({
        title: 'Updated Title',
        description: 'Updated Desc',
      });
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'mod-1');
    });

    it('should throw on update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Permission denied' } }));

      await expect(service.updateModule('mod-1', {
        module: { title: 'X', description: null, module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'v.mp4', thumbnail_url: null, duration: null } },
      })).rejects.toThrow('Permission denied');
    });
  });

  describe('deleteModule', () => {
    it('should delete module by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.deleteModule('mod-1');

      expect(supabase.client.from).toHaveBeenCalledWith('modules');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'mod-1');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Cannot delete' } }));

      await expect(service.deleteModule('mod-1')).rejects.toThrow('Cannot delete');
    });
  });

  describe('swapModuleSortOrder', () => {
    it('should swap sort_order of two modules', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.swapModuleSortOrder('m1', 0, 'm2', 1);

      expect(supabase.client.from).toHaveBeenCalledWith('modules');
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ sort_order: 1 });
      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({ sort_order: 0 });
    });

    it('should throw on first update error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Reorder failed' } }));

      await expect(service.swapModuleSortOrder('m1', 0, 'm2', 1)).rejects.toThrow('Reorder failed');
    });
  });

  describe('loadModuleForEdit', () => {
    it('should load module and convert video content to form data', async () => {
      // Step 1: load module metadata → .single()
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-1', title: 'Video Mod', description: 'A video', module_type: 'video', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        // Step 2: fetch video content → .single()
        .mockResolvedValueOnce({
          data: { bunny_video_id: 'test-guid', bunny_library_id: 12345, encoding_status: 3, duration: 120, thumbnail_url: null, original_filename: 'video.mp4' },
          error: null,
        });

      const result = await service.loadModuleForEdit('mod-1');

      expect(result.module.id).toBe('mod-1');
      expect(result.module.title).toBe('Video Mod');
      expect(result.module.module_type).toBe('video');
      expect(result.module.description).toBe('A video');
      expect(result.content.type).toBe('video');
      if (result.content.type === 'video') {
        expect(result.content.data).toEqual({
          bunny_video_id: 'test-guid',
          bunny_library_id: 12345,
          original_filename: 'video.mp4',
        });
      }
    });

    // PDF file_url is a storage path in the DB — #fetchModuleContent resolves it
    // to a signed URL via createSignedUrl() so the viewer can display it securely.
    it('should load module and convert PDF content to form data with signed URL', async () => {
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-2', title: 'PDF Mod', description: null, module_type: 'pdf', sort_order: 1, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { file_url: 'course-1/123-test.pdf', file_name: 'test.pdf', page_count: 10 },
          error: null,
        });

      const result = await service.loadModuleForEdit('mod-2');

      expect(result.module.module_type).toBe('pdf');
      expect(result.content.type).toBe('pdf');
      if (result.content.type === 'pdf') {
        // file_url should be a signed URL (from mock: createSignedUrl returns signedUrl)
        expect(result.content.data).toEqual({
          file_url: expect.stringContaining('sign'),
          file_name: 'test.pdf',
          page_count: 10,
        });
      }
    });

    // exam_file_url is optional — when present, it's resolved to a signed URL.
    it('should load module and convert exam content to form data with signed URL', async () => {
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-3', title: 'Exam Mod', description: 'Final exam', module_type: 'exam', sort_order: 2, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            title: 'Final Exam',
            description: 'End of course exam',
            duration_minutes: 90,
            passing_score: 70,
            max_file_size: 52428800,
            allowed_file_types: ['application/pdf'],
            exam_file_url: 'course-1/456-exam.pdf',
          },
          error: null,
        });

      const result = await service.loadModuleForEdit('mod-3');

      expect(result.module.module_type).toBe('exam');
      expect(result.content.type).toBe('exam');
      if (result.content.type === 'exam') {
        expect(result.content.data).toEqual({
          title: 'Final Exam',
          description: 'End of course exam',
          duration_minutes: 90,
          passing_score: 70,
          max_file_size: 52428800,
          allowed_file_types: ['application/pdf'],
          // exam_file_url resolved to signed URL
          exam_file_url: expect.stringContaining('sign'),
        });
      }
    });

    it('should return empty file_url for PDF when storage file is missing', async () => {
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-pdf', title: 'PDF Mod', description: null, module_type: 'pdf', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { file_url: 'course-1/deleted.pdf', file_name: 'deleted.pdf', page_count: 5 },
          error: null,
        });

      // Mock createSignedUrl to fail (file deleted from storage)
      const storageMock = supabase.client.storage.from('course-files');
      storageMock.createSignedUrl = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Object not found' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.loadModuleForEdit('mod-pdf');

      expect(result.content.type).toBe('pdf');
      if (result.content.type === 'pdf') {
        // file_url should be empty string when file is missing
        expect(result.content.data.file_url).toBe('');
        expect(result.content.data.file_name).toBe('deleted.pdf');
      }

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deleted.pdf'));
      warnSpy.mockRestore();
    });

    it('should clear exam_file_url when storage file is missing', async () => {
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-exam', title: 'Exam Mod', description: null, module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            title: 'Final Exam',
            description: 'Exam',
            duration_minutes: 90,
            passing_score: 70,
            max_file_size: 52428800,
            allowed_file_types: ['application/pdf'],
            exam_file_url: 'course-1/deleted-exam.pdf',
          },
          error: null,
        });

      // Mock createSignedUrl to fail
      const storageMock = supabase.client.storage.from('course-files');
      storageMock.createSignedUrl = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Object not found' },
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await service.loadModuleForEdit('mod-exam');

      expect(result.content.type).toBe('exam');
      if (result.content.type === 'exam') {
        // exam_file_url should be null when file is missing (optional field)
        expect(result.content.data.exam_file_url).toBeNull();
      }

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('deleted-exam.pdf'));
      warnSpy.mockRestore();
    });

    it('should throw on load error', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Module not found' },
      });

      await expect(service.loadModuleForEdit('bad-id')).rejects.toThrow('Module not found');
    });
  });

  describe('createModule with PDF content', () => {
    it('should insert module + PDF content and return id', async () => {
      // insert module → .select('id').single()
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'new-pdf-mod' },
        error: null,
      });
      // insert module_pdfs → .then()
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      const result = await service.createModule('c1', {
        module: { title: 'PDF Module', description: null, module_type: 'pdf', lecture_id: 'l1' },
        content: { type: 'pdf', data: { file_url: 'https://storage/doc.pdf', file_name: 'doc.pdf', page_count: 5 } },
      });

      expect(result).toEqual({ id: 'new-pdf-mod' });
      expect(supabase.client.from).toHaveBeenCalledWith('module_pdfs');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        module_id: 'new-pdf-mod',
        file_url: 'https://storage/doc.pdf',
        file_name: 'doc.pdf',
        page_count: 5,
      });
    });
  });

  describe('createModule with Exam content', () => {
    it('should insert module + exam content and return id', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'new-exam-mod' },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      const result = await service.createModule('c1', {
        module: { title: 'Exam Module', description: null, module_type: 'exam', lecture_id: 'l1' },
        content: {
          type: 'exam',
          data: {
            title: 'Final Exam',
            description: 'Course exam',
            duration_minutes: 60,
            passing_score: 70,
            max_file_size: 52428800,
            allowed_file_types: ['application/pdf', 'application/zip'],
            exam_file_url: null,
          },
        },
      });

      expect(result).toEqual({ id: 'new-exam-mod' });
      expect(supabase.client.from).toHaveBeenCalledWith('exams');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        module_id: 'new-exam-mod',
        title: 'Final Exam',
        description: 'Course exam',
        duration_minutes: 60,
        passing_score: 70,
        max_file_size: 52428800,
        allowed_file_types: ['application/pdf', 'application/zip'],
        exam_file_url: null,
      });
    });
  });

  describe('updateModule with significantUpdate', () => {
    it('should set significant_update_at when significantUpdate is true', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateModule('mod-1', {
        module: { title: 'Updated', description: null, module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'v.mp4', thumbnail_url: null, duration: null } },
        significantUpdate: true,
      });

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated',
          description: null,
          significant_update_at: expect.any(String),
        }),
      );
    });

    it('should not set significant_update_at when significantUpdate is false', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateModule('mod-1', {
        module: { title: 'Updated', description: null, module_type: 'video', lecture_id: 'l1' },
        content: { type: 'video', data: { video_url: 'v.mp4', thumbnail_url: null, duration: null } },
      });

      expect(supabase._mockQueryBuilder.update).toHaveBeenCalledWith({
        title: 'Updated',
        description: null,
      });
    });
  });

  describe('updateModule with PDF content', () => {
    it('should upsert PDF content on update', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateModule('mod-2', {
        module: { title: 'Updated PDF', description: null, module_type: 'pdf', lecture_id: 'l1' },
        content: { type: 'pdf', data: { file_url: 'https://storage/new.pdf', file_name: 'new.pdf', page_count: 20 } },
      });

      expect(supabase.client.from).toHaveBeenCalledWith('module_pdfs');
      expect(supabase._mockQueryBuilder.upsert).toHaveBeenCalledWith(
        {
          module_id: 'mod-2',
          file_url: 'https://storage/new.pdf',
          file_name: 'new.pdf',
          page_count: 20,
        },
        { onConflict: 'module_id' },
      );
    });
  });

  describe('updateModule with Exam content', () => {
    it('should upsert exam content on update', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateModule('mod-3', {
        module: { title: 'Updated Exam', description: null, module_type: 'exam', lecture_id: 'l1' },
        content: {
          type: 'exam',
          data: {
            title: 'Updated Exam',
            description: null,
            duration_minutes: 120,
            passing_score: 80,
            max_file_size: 104857600,
            allowed_file_types: ['application/pdf'],
            exam_file_url: 'https://storage/exam-v2.pdf',
          },
        },
      });

      expect(supabase.client.from).toHaveBeenCalledWith('exams');
      expect(supabase._mockQueryBuilder.upsert).toHaveBeenCalledWith(
        {
          module_id: 'mod-3',
          title: 'Updated Exam',
          description: null,
          duration_minutes: 120,
          passing_score: 80,
          max_file_size: 104857600,
          allowed_file_types: ['application/pdf'],
          exam_file_url: 'https://storage/exam-v2.pdf',
        },
        { onConflict: 'module_id' },
      );
    });
  });

  describe('createModule with Markdown content', () => {
    it('should insert module + markdown content and return id', async () => {
      supabase._mockQueryBuilder.single.mockResolvedValueOnce({
        data: { id: 'new-markdown-mod' },
        error: null,
      });
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      const result = await service.createModule('c1', {
        module: { title: 'Markdown Module', description: 'A markdown module', module_type: 'markdown', lecture_id: 'l1' },
        content: { type: 'markdown', data: { content: '# Hello World\n\nSome markdown text' } },
      });

      expect(result).toEqual({ id: 'new-markdown-mod' });
      expect(supabase.client.from).toHaveBeenCalledWith('module_markdown');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        module_id: 'new-markdown-mod',
        content: '# Hello World\n\nSome markdown text',
      });
    });
  });

  describe('updateModule with Markdown content', () => {
    it('should upsert markdown content on update', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.updateModule('mod-md', {
        module: { title: 'Updated Markdown', description: null, module_type: 'markdown', lecture_id: 'l1' },
        content: { type: 'markdown', data: { content: '# Updated content' } },
      });

      expect(supabase.client.from).toHaveBeenCalledWith('module_markdown');
      expect(supabase._mockQueryBuilder.upsert).toHaveBeenCalledWith(
        {
          module_id: 'mod-md',
          content: '# Updated content',
        },
        { onConflict: 'module_id' },
      );
    });
  });

  describe('loadModuleForEdit with Markdown content', () => {
    it('should load module and convert markdown content to form data', async () => {
      supabase._mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: { id: 'mod-md', title: 'Markdown Mod', description: 'Notes', module_type: 'markdown', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { content: '# Hello' },
          error: null,
        });

      const result = await service.loadModuleForEdit('mod-md');

      expect(result.module.id).toBe('mod-md');
      expect(result.module.title).toBe('Markdown Mod');
      expect(result.module.module_type).toBe('markdown');
      expect(result.module.description).toBe('Notes');
      expect(result.content.type).toBe('markdown');
      if (result.content.type === 'markdown') {
        expect(result.content.data).toEqual({ content: '# Hello' });
      }
    });
  });

  describe('loadModuleFiles', () => {
    it('should load and return module files', async () => {
      const mockFiles = [
        { id: 'f1', file_url: 'https://storage/file1.pdf', file_name: 'file1.pdf', file_size: 1024 },
        { id: 'f2', file_url: 'https://storage/file2.zip', file_name: 'file2.zip', file_size: 2048 },
      ];
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: mockFiles, error: null }));

      const result = await service.loadModuleFiles('mod-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 'f1', file_url: 'https://storage/file1.pdf', file_name: 'file1.pdf', file_size: 1024 });
      expect(result[1]).toEqual({ id: 'f2', file_url: 'https://storage/file2.zip', file_name: 'file2.zip', file_size: 2048 });
      expect(supabase.client.from).toHaveBeenCalledWith('module_files');
    });

    it('should throw on load error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Failed to load' } }));

      await expect(service.loadModuleFiles('mod-1')).rejects.toThrow('Failed to load');
    });
  });

  describe('addModuleFile', () => {
    it('should insert a module file', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.addModuleFile('mod-1', { file_url: 'https://storage/new-file.pdf', file_name: 'new-file.pdf', file_size: 1024 });

      expect(supabase.client.from).toHaveBeenCalledWith('module_files');
      expect(supabase._mockQueryBuilder.insert).toHaveBeenCalledWith({
        module_id: 'mod-1',
        file_url: 'https://storage/new-file.pdf',
        file_name: 'new-file.pdf',
        file_size: 1024,
      });
    });

    it('should throw on insert error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Upload failed' } }));

      await expect(service.addModuleFile('mod-1', { file_url: 'https://storage/f.pdf', file_name: 'f.pdf', file_size: 512 })).rejects.toThrow('Upload failed');
    });
  });

  describe('deleteModuleFile', () => {
    it('should delete a module file by id', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: unknown; error: null }) => void) =>
        resolve({ data: null, error: null }));

      await service.deleteModuleFile('file-1');

      expect(supabase.client.from).toHaveBeenCalledWith('module_files');
      expect(supabase._mockQueryBuilder.delete).toHaveBeenCalled();
      expect(supabase._mockQueryBuilder.eq).toHaveBeenCalledWith('id', 'file-1');
    });

    it('should throw on delete error', async () => {
      supabase._mockQueryBuilder.then.mockImplementation((resolve: (value: { data: null; error: { message: string } }) => void) =>
        resolve({ data: null, error: { message: 'Cannot delete file' } }));

      await expect(service.deleteModuleFile('file-1')).rejects.toThrow('Cannot delete file');
    });
  });
});
