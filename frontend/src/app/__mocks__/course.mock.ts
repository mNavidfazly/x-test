import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  CourseWithProgress, CourseDetail, ModuleViewerData,
  ModuleVideo, ModulePdf, ModuleMarkdownContent, ModuleFile,
  CourseFormData, TenantSummary, LectureFormData,
} from '../core/models/course.model';

export function createMockCourseService(options?: {
  courses?: CourseWithProgress[];
  courseDetail?: CourseDetail | null;
  moduleViewer?: ModuleViewerData | null;
  loading?: boolean;
  error?: string;
}) {
  const courses = signal<CourseWithProgress[]>(options?.courses ?? []);
  const courseDetail = signal<CourseDetail | null>(options?.courseDetail ?? null);
  const moduleViewer = signal<ModuleViewerData | null>(options?.moduleViewer ?? null);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    courses: courses.asReadonly(),
    courseDetail: courseDetail.asReadonly(),
    moduleViewer: moduleViewer.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadCourses: vi.fn().mockResolvedValue(undefined),
    loadCourseDetail: vi.fn().mockResolvedValue(undefined),
    loadModuleViewer: vi.fn().mockResolvedValue(undefined),
    markModuleComplete: vi.fn().mockResolvedValue(undefined),
    createCourse: vi.fn().mockResolvedValue({ id: 'new-course-id' }),
    updateCourse: vi.fn().mockResolvedValue(undefined),
    deleteCourse: vi.fn().mockResolvedValue(undefined),
    loadTenants: vi.fn().mockResolvedValue([]),
    loadTenantAssignments: vi.fn().mockResolvedValue([]),
    assignCourseToTenant: vi.fn().mockResolvedValue(undefined),
    removeCourseFromTenant: vi.fn().mockResolvedValue(undefined),
    createLecture: vi.fn().mockResolvedValue({ id: 'new-lecture-id' }),
    updateLecture: vi.fn().mockResolvedValue(undefined),
    deleteLecture: vi.fn().mockResolvedValue(undefined),
    swapLectureSortOrder: vi.fn().mockResolvedValue(undefined),
    _setCourses: courses.set.bind(courses),
    _setCourseDetail: courseDetail.set.bind(courseDetail),
    _setModuleViewer: moduleViewer.set.bind(moduleViewer),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockCourseService = ReturnType<typeof createMockCourseService>;

export function createMockCourseWithProgress(overrides?: Partial<CourseWithProgress>): CourseWithProgress {
  return {
    id: 'course-1',
    title: 'Test Course',
    description: 'A test course description',
    thumbnail_url: null,
    enrollment_type: 'open',
    moduleCount: 10,
    completedModules: 3,
    progressPercent: 30,
    isEnrolled: true,
    lastActivity: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

export function createMockCourseDetail(overrides?: Partial<CourseDetail>): CourseDetail {
  return {
    id: 'course-1',
    title: 'Test Course',
    description: 'A test course description',
    thumbnail_url: null,
    enrollment_type: 'open',
    lectures: [
      {
        id: 'lecture-1',
        title: 'Lecture 1',
        description: null,
        sort_order: 0,
        modules: [
          { id: 'mod-1', title: 'Module 1', module_type: 'video', sort_order: 0 },
          { id: 'mod-2', title: 'Module 2', module_type: 'pdf', sort_order: 1 },
        ],
      },
      {
        id: 'lecture-2',
        title: 'Lecture 2',
        description: 'Second lecture',
        sort_order: 1,
        modules: [
          { id: 'mod-3', title: 'Module 3', module_type: 'quiz', sort_order: 0 },
        ],
      },
    ],
    progressMap: {
      'mod-1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
      'mod-2': { status: 'in_progress', completed_at: null },
    },
    ...overrides,
  };
}

export function createMockModuleVideo(overrides?: Partial<ModuleVideo>): ModuleVideo {
  return {
    video_url: 'https://cdn.bunny.net/test-video.mp4',
    thumbnail_url: 'https://cdn.bunny.net/thumb.jpg',
    duration: 360,
    ...overrides,
  };
}

export function createMockModulePdf(overrides?: Partial<ModulePdf>): ModulePdf {
  return {
    file_url: 'https://storage.supabase.co/test.pdf',
    file_name: 'test-document.pdf',
    page_count: 12,
    ...overrides,
  };
}

export function createMockModuleMarkdown(overrides?: Partial<ModuleMarkdownContent>): ModuleMarkdownContent {
  return {
    content: '# Test Markdown\n\nSome **bold** text.',
    ...overrides,
  };
}

export function createMockModuleFile(overrides?: Partial<ModuleFile>): ModuleFile {
  return {
    id: 'file-1',
    file_url: 'https://storage.supabase.co/attachment.zip',
    file_name: 'resources.zip',
    file_size: 1048576,
    ...overrides,
  };
}

export function createMockModuleViewerData(overrides?: Partial<ModuleViewerData>): ModuleViewerData {
  return {
    module: {
      id: 'mod-1',
      title: 'Test Module',
      description: 'A test module',
      module_type: 'video',
      sort_order: 0,
      lecture_id: 'lecture-1',
      course_id: 'course-1',
    },
    content: { type: 'video', data: createMockModuleVideo() },
    files: [],
    progress: null,
    navigation: {
      prev: null,
      next: { id: 'mod-2', title: 'Next Module', module_type: 'pdf', lectureTitle: 'Lecture 1' },
      current: 1,
      total: 3,
    },
    ...overrides,
  };
}

// Phase 3A: Course CRUD factories

export function createMockCourseFormData(overrides?: Partial<CourseFormData>): CourseFormData {
  return {
    title: 'New Course',
    description: 'A new course description',
    thumbnail_url: null,
    enrollment_type: 'open',
    password_hash: null,
    staleness_threshold_days: null,
    ...overrides,
  };
}

export function createMockLectureFormData(overrides?: Partial<LectureFormData>): LectureFormData {
  return {
    title: 'New Lecture',
    description: 'A lecture description',
    ...overrides,
  };
}

export function createMockTenantSummary(overrides?: Partial<TenantSummary>): TenantSummary {
  return {
    id: 'tenant-1',
    name: 'Test Tenant',
    domain: 'test.com',
    is_master: false,
    ...overrides,
  };
}
