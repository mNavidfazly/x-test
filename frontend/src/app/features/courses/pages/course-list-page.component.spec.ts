import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { provideRouter } from '@angular/router';
import { CourseListPageComponent } from './course-list-page.component';
import { CourseService } from '../../../core/services/course.service';
import { CourseCardComponent } from '../components/course-card.component';
import { createMockCourseService, createMockCourseWithProgress } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

describe('CourseListPageComponent', () => {
  it('should render page title', async () => {
    const courseService = createMockCourseService();

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
      ],
    });

    expect(screen.getByText('My Courses')).toBeTruthy();
  });

  it('should call loadCourses on init', async () => {
    const courseService = createMockCourseService();

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
      ],
    });

    expect(courseService.loadCourses).toHaveBeenCalled();
  });

  it('should show loading skeletons', async () => {
    const courseService = createMockCourseService({ loading: true });

    const { container } = await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
      ],
    });

    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBe(6);
  });

  it('should show empty state when no courses', async () => {
    const courseService = createMockCourseService({ courses: [] });

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
      ],
    });

    expect(screen.getByText('No courses available yet.')).toBeTruthy();
  });

  it('should render course cards', async () => {
    const courseService = createMockCourseService({
      courses: [
        createMockCourseWithProgress({ id: 'c1', title: 'Course One' }),
        createMockCourseWithProgress({ id: 'c2', title: 'Course Two' }),
      ],
    });

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
      ],
    });

    expect(screen.getByText('Course One')).toBeTruthy();
    expect(screen.getByText('Course Two')).toBeTruthy();
  });

  it('should show error message', async () => {
    const courseService = createMockCourseService({ error: 'Failed to load' });

    await render(CourseListPageComponent, {
      componentImports: [MockLucideIconComponent, CourseCardComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
      ],
    });

    expect(screen.getByText('Failed to load')).toBeTruthy();
  });
});
