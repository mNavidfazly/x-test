import { signal } from '@angular/core';
import { vi } from 'vitest';
import { ContentCourse, ContentLecture, ContentModule } from '../core/models/content-management.model';

export function createMockContentModule(overrides?: Partial<ContentModule>): ContentModule {
  return {
    id: 'mod-1',
    title: 'Test Module',
    module_type: 'video',
    sort_order: 0,
    estimated_duration_minutes: 15,
    updated_at: '2026-01-15T10:00:00Z',
    daysSinceUpdate: 30,
    isStale: false,
    isPostponed: false,
    postponedUntil: null,
    ...overrides,
  };
}

export function createMockContentLecture(overrides?: Partial<ContentLecture>): ContentLecture {
  return {
    id: 'lec-1',
    title: 'Lecture 1',
    sort_order: 0,
    modules: [createMockContentModule()],
    ...overrides,
  };
}

export function createMockContentCourse(overrides?: Partial<ContentCourse>): ContentCourse {
  const lectures = overrides?.lectures ?? [createMockContentLecture()];
  const allModules = lectures.flatMap(l => l.modules);
  return {
    id: 'course-1',
    title: 'Test Course',
    description: 'A test course',
    thumbnail_url: null,
    enrollment_type: 'open',
    staleness_threshold_days: 180,
    updated_at: '2026-01-15T10:00:00Z',
    lectures,
    tenantCount: 2,
    lectureCount: lectures.length,
    totalModules: allModules.length,
    modulesByType: { video: allModules.length },
    staleModuleCount: allModules.filter(m => m.isStale).length,
    freshModuleCount: allModules.filter(m => !m.isStale && !m.isPostponed).length,
    postponedModuleCount: allModules.filter(m => m.isPostponed).length,
    hasStaleModules: allModules.some(m => m.isStale),
    lastModuleUpdate: allModules.length > 0 ? allModules[0].updated_at : null,
    totalDurationMinutes: allModules.reduce((sum, m) => sum + m.estimated_duration_minutes, 0),
    ...overrides,
  };
}

export function createMockContentManagementService(options?: {
  courses?: ContentCourse[];
  loading?: boolean;
  error?: string;
}) {
  const courses = signal<ContentCourse[]>(options?.courses ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    courses: courses.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadContentOverview: vi.fn().mockResolvedValue(undefined),
    _setCourses: courses.set.bind(courses),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockContentManagementService = ReturnType<typeof createMockContentManagementService>;
