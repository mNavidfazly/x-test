import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { CourseDetailPageComponent } from './course-detail-page.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { LectureAccordionComponent } from '../components/lecture-accordion.component';
import { createMockCourseService, createMockCourseDetail } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

function mockActivatedRoute(courseId: string) {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => key === 'courseId' ? courseId : null,
      },
    },
  };
}

describe('CourseDetailPageComponent', () => {
  it('should call loadCourseDetail with route param', async () => {
    const courseService = createMockCourseService();

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('abc-123') },
      ],
    });

    expect(courseService.loadCourseDetail).toHaveBeenCalledWith('abc-123');
  });

  it('should show back link', async () => {
    const courseService = createMockCourseService();

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Back to courses')).toBeTruthy();
  });

  it('should show loading skeleton', async () => {
    const courseService = createMockCourseService({ loading: true });

    const { container } = await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should show error message', async () => {
    const courseService = createMockCourseService({ error: 'Course not found' });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Course not found')).toBeTruthy();
  });

  it('should render course title and description', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({
        title: 'Angular Advanced',
        description: 'Deep dive into Angular',
      }),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Angular Advanced')).toBeTruthy();
    expect(screen.getByText('Deep dive into Angular')).toBeTruthy();
  });

  it('should show progress summary', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail({
        lectures: [
          {
            id: 'l1', title: 'L1', description: null, sort_order: 0,
            modules: [
              { id: 'm1', title: 'M1', module_type: 'video', sort_order: 0 },
              { id: 'm2', title: 'M2', module_type: 'pdf', sort_order: 1 },
            ],
          },
        ],
        progressMap: {
          'm1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
        },
      }),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('1/2 modules completed')).toBeTruthy();
  });

  it('should render lecture accordions', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Lecture 1')).toBeTruthy();
    expect(screen.getByText('Lecture 2')).toBeTruthy();
  });

  it('should show Edit button for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Edit')).toBeTruthy();
  });

  it('should show Edit button for lecturer with can_edit', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        {
          provide: AuthService,
          useValue: createMockAuthService({
            isAuthenticated: true,
            roles: ['learner', 'lecturer'],
            claims: { lecturer_can_edit_course_ids: ['c1'] },
          }),
        },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Edit')).toBeTruthy();
    // Lecturer should NOT see Delete
    expect(screen.queryByText('Delete Course')).toBeNull();
  });

  it('should hide Edit button for regular learner', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Delete Course')).toBeNull();
  });

  it('should show Delete button for platform admin', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Delete Course')).toBeTruthy();
  });

  it('should show delete confirmation on click', async () => {
    const courseService = createMockCourseService({
      courseDetail: createMockCourseDetail(),
    });

    await render(CourseDetailPageComponent, {
      componentImports: [MockLucideIconComponent, LectureAccordionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } }) },
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    fireEvent.click(screen.getByText('Delete Course'));

    expect(screen.getByText('Yes, Delete')).toBeTruthy();
    expect(screen.getByText(/Are you sure/)).toBeTruthy();
  });
});
