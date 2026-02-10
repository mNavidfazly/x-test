import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { CourseDetailPageComponent } from './course-detail-page.component';
import { CourseService } from '../../../core/services/course.service';
import { LectureAccordionComponent } from '../components/lecture-accordion.component';
import { createMockCourseService, createMockCourseDetail } from '../../../__mocks__/course.mock';
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
        { provide: ActivatedRoute, useValue: mockActivatedRoute('c1') },
      ],
    });

    expect(screen.getByText('Lecture 1')).toBeTruthy();
    expect(screen.getByText('Lecture 2')).toBeTruthy();
  });
});
