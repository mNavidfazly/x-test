import { signal } from '@angular/core';
import { vi } from 'vitest';
import { CourseWithProgress, CourseDetail } from '../core/models/course.model';

export function createMockCourseService(options?: {
  courses?: CourseWithProgress[];
  courseDetail?: CourseDetail | null;
  loading?: boolean;
  error?: string;
}) {
  const courses = signal<CourseWithProgress[]>(options?.courses ?? []);
  const courseDetail = signal<CourseDetail | null>(options?.courseDetail ?? null);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    courses: courses.asReadonly(),
    courseDetail: courseDetail.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadCourses: vi.fn().mockResolvedValue(undefined),
    loadCourseDetail: vi.fn().mockResolvedValue(undefined),
    _setCourses: courses.set.bind(courses),
    _setCourseDetail: courseDetail.set.bind(courseDetail),
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
